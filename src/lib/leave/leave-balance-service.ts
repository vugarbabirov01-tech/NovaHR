import { findActiveLeaveTypes, findLeaveTypeById } from "@/repositories/leave-type-repository"
import { sumLeaveLedgerAmountsByEntryType, sumLeaveLedgerAmountsByEmployeeAndType } from "@/repositories/leave-ledger-repository"
import { sumPendingRequestedUnits } from "@/repositories/leave-request-repository"
import { resolveAnnualLeaveEntitlement } from "@/lib/leave/leave-policy-resolution-service"
import { normalizeLeaveAmount as normalizeZero } from "@/lib/leave/normalize-leave-amount"
import { findAllEmployees, findEmployeeById } from "@/repositories/employee-repository"
import type { LeaveEntryType } from "@/generated/prisma/enums"
import type { LeaveBalanceStatement, OrgLeaveDaysSummary } from "@/types/leave"

/** Local calendar components, not `.toISOString()` — see the matching doc
 * comment in leave-policy-resolution-service.ts for why. */
function toDateOnlyIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * The one place a set of entryType → amount sums becomes a balance
 * breakdown. Every consumer of this engine — per-employee
 * (computeLeaveBalance), org-wide (getOrganizationLeaveDaysSummary) — goes
 * through this function, so the mapping rule below is defined exactly once:
 *
 *   OPENING_BALANCE, IMPORTED_BALANCE → opening        (credit, as-is)
 *   ACCRUAL                           → accrued         (credit, as-is)
 *   CARRY_FORWARD                     → carriedForward  (credit, as-is)
 *   LEAVE_TAKEN + LEAVE_CANCELLED     → taken            (netted — a
 *     cancellation reverses a prior LEAVE_TAKEN, it doesn't get its own
 *     bucket; LEAVE_TAKEN is stored as a negative/debit amount,
 *     LEAVE_CANCELLED as a positive/credit reversal, so summing then
 *     negating gives "net days actually taken" as a positive number)
 *   MANUAL_ADJUSTMENT                 → adjusted         (signed as-is —
 *     an adjustment can go either direction, unlike the others)
 *   EXPIRY                            → expired          (shown positive)
 *   SETTLEMENT                        → settled          (shown positive)
 *   ENCASHMENT                        → encashed         (shown positive)
 *
 * `remaining` is deliberately NOT derived by re-summing the buckets above —
 * their signs are flipped for display and re-summing them risks silently
 * encoding a bug into the one number that must always match the ledger.
 * It's computed independently, straight from the raw per-entryType sums, so
 * it's always the true SUM(amount) regardless of how the display buckets
 * are presented.
 */
function mapEntryTypeSumsToBuckets(sums: Partial<Record<LeaveEntryType, number>>) {
  const opening = (sums.OPENING_BALANCE ?? 0) + (sums.IMPORTED_BALANCE ?? 0)
  const accrued = sums.ACCRUAL ?? 0
  const carriedForward = sums.CARRY_FORWARD ?? 0
  const taken = -((sums.LEAVE_TAKEN ?? 0) + (sums.LEAVE_CANCELLED ?? 0))
  const adjusted = sums.MANUAL_ADJUSTMENT ?? 0
  const expired = -(sums.EXPIRY ?? 0)
  const settled = -(sums.SETTLEMENT ?? 0)
  const encashed = -(sums.ENCASHMENT ?? 0)

  const remaining = Object.values(sums).reduce((total: number, value) => total + (value ?? 0), 0)

  return {
    opening: normalizeZero(opening),
    accrued: normalizeZero(accrued),
    carriedForward: normalizeZero(carriedForward),
    taken: normalizeZero(taken),
    adjusted: normalizeZero(adjusted),
    expired: normalizeZero(expired),
    settled: normalizeZero(settled),
    encashed: normalizeZero(encashed),
    remaining: normalizeZero(remaining),
  }
}

/**
 * The employee's Annual Leave entitlement (resolveAnnualLeaveEntitlement —
 * Labour Code Art. 112-120), used ONLY as a fallback opening balance for
 * the ANNUAL leave type, and ONLY when no OPENING_BALANCE/IMPORTED_BALANCE
 * ledger row has ever been recorded for this employee/type — a real ledger
 * entry always wins. Without this, an employee with no imported ledger
 * history shows "0 days" for their entire annual balance even though their
 * entitlement (21/30/35/... depending on their profile) is fully knowable —
 * that's the actual bug, not a display issue, so the fix belongs in the
 * balance calculation, not the UI. Returns null for any non-ANNUAL type or
 * an unresolvable employee, in which case the caller keeps the ledger-only
 * (possibly zero) figures exactly as before.
 */
async function resolveFallbackAnnualEntitlementDays(
  employeeId: string,
  leaveTypeId: string,
  asOfDate: Date
): Promise<number | null> {
  const leaveType = await findLeaveTypeById(leaveTypeId)
  if (leaveType?.code !== "ANNUAL") return null
  const profile = await findEmployeeById(employeeId)
  if (!profile) return null
  return resolveAnnualLeaveEntitlement(profile, asOfDate).totalDays
}

/**
 * Reconstructs one employee's balance for one leave type, as of a date
 * (defaults to today) — the ledger portion is always from LeaveLedgerEntry,
 * never a stored column; this is the read-side counterpart to Phase 1's
 * recordLeaveLedgerEntryAction: that writes raw rows, this is the only
 * function that turns them back into a balance. `pending` additionally
 * folds in this employee's PENDING_APPROVAL requests for this leave type
 * (see LeaveBalanceStatement's doc comment for why that's kept separate
 * from `remaining` rather than subtracted from it).
 */
export async function computeLeaveBalance(
  employeeId: string,
  leaveTypeId: string,
  asOfDate: Date = new Date()
): Promise<LeaveBalanceStatement> {
  const [sums, pending] = await Promise.all([
    sumLeaveLedgerAmountsByEntryType({ employeeId, leaveTypeId, asOfDate }),
    sumPendingRequestedUnits({ employeeId, leaveTypeId }),
  ])
  const buckets = mapEntryTypeSumsToBuckets(sums)

  const hasRecordedOpeningBalance = sums.OPENING_BALANCE !== undefined || sums.IMPORTED_BALANCE !== undefined
  if (!hasRecordedOpeningBalance) {
    const entitlementDays = await resolveFallbackAnnualEntitlementDays(employeeId, leaveTypeId, asOfDate)
    if (entitlementDays) {
      buckets.opening = normalizeZero(buckets.opening + entitlementDays)
      buckets.remaining = normalizeZero(buckets.remaining + entitlementDays)
    }
  }

  return {
    employeeId,
    leaveTypeId,
    asOfDate: toDateOnlyIso(asOfDate),
    ...buckets,
    pending: normalizeZero(pending),
  }
}

/**
 * One balance statement per active LeaveType — the "Employee Leave
 * Summary". A type with zero ledger activity still gets a statement (all
 * zeros, or the ANNUAL entitlement fallback — see computeLeaveBalance), so
 * the UI can show every configured leave type consistently rather than
 * only the ones an employee happens to have entries for.
 */
export async function getEmployeeLeaveSummary(
  employeeId: string,
  asOfDate: Date = new Date()
): Promise<LeaveBalanceStatement[]> {
  const leaveTypes = await findActiveLeaveTypes()
  return Promise.all(leaveTypes.map((leaveType) => computeLeaveBalance(employeeId, leaveType.id, asOfDate)))
}

/**
 * Org-wide rollup for the Dashboard — scoped to DAYS-unit leave types only.
 * See OrgLeaveDaysSummary's doc comment for why HOURS-unit types are
 * excluded: summing across incompatible units would silently produce a
 * meaningless total.
 *
 * Applies the exact same rule computeLeaveBalance uses per employee — same
 * mapEntryTypeSumsToBuckets bucket mapping, same "no recorded opening
 * balance -> fall back to the resolved ANNUAL entitlement" rule — but as a
 * bulk computation: one groupBy across every employee/leave type instead
 * of a separate query per (employee, leaveType) pair. That per-pair
 * version (still what computeLeaveBalance itself does, for the Employee
 * Profile/Review-step single-employee case) was fine at the original
 * demo-scale directory size, but O(employees x leaveTypes) individual
 * queries stopped being a "small" number the moment a real import brought
 * the directory to 237+ employees — it was taking long enough to
 * starve the single dev-server process and make unrelated pages (e.g. an
 * Employee Profile navigation) appear to hang. `pending` is also fetched
 * once here (not per statement) since this function never used the
 * per-employee pending figure anyway — computeLeaveBalance still computes
 * it because single-employee callers need it.
 */
export async function getOrganizationLeaveDaysSummary(
  asOfDate: Date = new Date()
): Promise<OrgLeaveDaysSummary> {
  const leaveTypes = (await findActiveLeaveTypes()).filter((leaveType) => leaveType.unit === "DAYS")
  const leaveTypeIds = leaveTypes.map((leaveType) => leaveType.id)
  const annualLeaveTypeId = leaveTypes.find((leaveType) => leaveType.code === "ANNUAL")?.id

  const [grouped, employees] = await Promise.all([
    sumLeaveLedgerAmountsByEmployeeAndType({ leaveTypeIds, asOfDate }),
    findAllEmployees(),
  ])

  const sumsByEmployeeAndType = new Map<string, Partial<Record<LeaveEntryType, number>>>()
  for (const row of grouped) {
    const key = `${row.employeeId}:${row.leaveTypeId}`
    const bucket = sumsByEmployeeAndType.get(key) ?? {}
    bucket[row.entryType] = row.amount
    sumsByEmployeeAndType.set(key, bucket)
  }

  let totalOpeningBalance = 0
  let totalCarriedForward = 0
  let totalTaken = 0
  let totalRemaining = 0

  for (const employee of employees) {
    for (const leaveType of leaveTypes) {
      const sums = sumsByEmployeeAndType.get(`${employee.id}:${leaveType.id}`) ?? {}
      const buckets = mapEntryTypeSumsToBuckets(sums)

      const hasRecordedOpeningBalance = sums.OPENING_BALANCE !== undefined || sums.IMPORTED_BALANCE !== undefined
      if (!hasRecordedOpeningBalance && leaveType.id === annualLeaveTypeId) {
        const entitlementDays = resolveAnnualLeaveEntitlement(employee, asOfDate).totalDays
        if (entitlementDays) {
          buckets.opening = normalizeZero(buckets.opening + entitlementDays)
          buckets.remaining = normalizeZero(buckets.remaining + entitlementDays)
        }
      }

      totalOpeningBalance += buckets.opening
      totalCarriedForward += buckets.carriedForward
      totalTaken += buckets.taken
      totalRemaining += buckets.remaining
    }
  }

  const totalPending = await sumPendingRequestedUnits({ unit: "DAYS" })

  return {
    asOfDate: toDateOnlyIso(asOfDate),
    totalOpeningBalance: normalizeZero(totalOpeningBalance),
    totalCarriedForward: normalizeZero(totalCarriedForward),
    totalTaken: normalizeZero(totalTaken),
    totalRemaining: normalizeZero(totalRemaining),
    totalPending: normalizeZero(totalPending),
  }
}
