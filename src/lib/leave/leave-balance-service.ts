import { findActiveLeaveTypes } from "@/repositories/leave-type-repository"
import { sumLeaveLedgerAmountsByEntryType } from "@/repositories/leave-ledger-repository"
import type { LeaveEntryType } from "@/generated/prisma/enums"
import type { LeaveBalanceStatement, OrgLeaveDaysSummary } from "@/types/leave"

function toDateOnlyIso(date: Date): string {
  return date.toISOString().slice(0, 10)
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

  return { opening, accrued, carriedForward, taken, adjusted, expired, settled, encashed, remaining }
}

/**
 * Reconstructs one employee's balance for one leave type, as of a date
 * (defaults to today) — always from the ledger, never from a stored
 * column. This is the read-side counterpart to Phase 1's
 * recordLeaveLedgerEntryAction: that writes raw rows, this is the only
 * function that turns them back into a balance.
 */
export async function computeLeaveBalance(
  employeeId: string,
  leaveTypeId: string,
  asOfDate: Date = new Date()
): Promise<LeaveBalanceStatement> {
  const sums = await sumLeaveLedgerAmountsByEntryType({ employeeId, leaveTypeId, asOfDate })
  const buckets = mapEntryTypeSumsToBuckets(sums)
  return { employeeId, leaveTypeId, asOfDate: toDateOnlyIso(asOfDate), ...buckets }
}

/**
 * One balance statement per active LeaveType — the "Employee Leave
 * Summary". A type with zero ledger activity still gets a statement (all
 * zeros), so the UI can show every configured leave type consistently
 * rather than only the ones an employee happens to have entries for.
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
 * See OrgLeaveDaysSummary's doc comment (src/types/leave.ts) for why
 * HOURS-unit types are excluded: summing across incompatible units would
 * silently produce a meaningless total.
 */
export async function getOrganizationLeaveDaysSummary(
  asOfDate: Date = new Date()
): Promise<OrgLeaveDaysSummary> {
  const sums = await sumLeaveLedgerAmountsByEntryType({ unit: "DAYS", asOfDate })
  const buckets = mapEntryTypeSumsToBuckets(sums)
  return {
    asOfDate: toDateOnlyIso(asOfDate),
    totalOpeningBalance: buckets.opening,
    totalCarriedForward: buckets.carriedForward,
    totalTaken: buckets.taken,
    totalRemaining: buckets.remaining,
  }
}
