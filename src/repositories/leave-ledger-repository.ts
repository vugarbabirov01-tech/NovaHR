import { prisma } from "@/lib/prisma"
import type { LeaveLedgerEntryModel } from "@/generated/prisma/models"
import type { LeaveEntryReferenceType, LeaveEntryType, LeaveUnit } from "@/generated/prisma/enums"

export type { LeaveLedgerEntryModel as LeaveLedgerEntry }

/**
 * Append-only by design — see the schema.prisma header comment. There is no
 * update/delete function in this file, intentionally: a correction is a new
 * reversing entry (entryType: MANUAL_ADJUSTMENT), never an edit, so a
 * balance is always reconstructable by summing every row that ever existed.
 */
export interface LeaveLedgerEntryInput {
  employeeId: string
  leaveTypeId: string
  companyId?: string | null
  entryType: LeaveEntryType
  /** Signed — positive credits the balance, negative debits it. */
  amount: number
  unit: LeaveUnit
  effectiveDate: Date
  referenceType?: LeaveEntryReferenceType | null
  referenceId?: string | null
  note?: string | null
  createdBy: string
}

export function findLeaveLedgerEntriesByEmployee(
  employeeId: string,
  leaveTypeId?: string
): Promise<LeaveLedgerEntryModel[]> {
  return prisma.leaveLedgerEntry.findMany({
    where: { employeeId, ...(leaveTypeId ? { leaveTypeId } : {}) },
    orderBy: { effectiveDate: "asc" },
  })
}

export function findLeaveLedgerEntriesByReference(
  referenceType: LeaveEntryReferenceType,
  referenceId: string
): Promise<LeaveLedgerEntryModel[]> {
  return prisma.leaveLedgerEntry.findMany({ where: { referenceType, referenceId } })
}

export interface SumLeaveLedgerAmountsFilter {
  employeeId?: string
  leaveTypeId?: string
  unit?: LeaveUnit
  /** Only entries effective on or before this date — what makes a balance
   * point-in-time reconstructable rather than always "as of now". */
  asOfDate?: Date
}

/**
 * Mechanical grouping only — sums `amount` per entryType and returns
 * whatever entryTypes actually have rows (types with no activity are simply
 * absent from the result, not zeroed). What each entryType *means* for a
 * balance (which bucket it belongs to, how it's signed for display) is
 * business logic that lives in src/lib/leave/leave-balance-service.ts, not
 * here — this function has no opinion on that.
 */
export async function sumLeaveLedgerAmountsByEntryType(
  filter: SumLeaveLedgerAmountsFilter
): Promise<Partial<Record<LeaveEntryType, number>>> {
  const grouped = await prisma.leaveLedgerEntry.groupBy({
    by: ["entryType"],
    _sum: { amount: true },
    where: {
      ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
      ...(filter.leaveTypeId ? { leaveTypeId: filter.leaveTypeId } : {}),
      ...(filter.unit ? { unit: filter.unit } : {}),
      ...(filter.asOfDate ? { effectiveDate: { lte: filter.asOfDate } } : {}),
    },
  })

  const sums: Partial<Record<LeaveEntryType, number>> = {}
  for (const row of grouped) {
    sums[row.entryType] = row._sum.amount ?? 0
  }
  return sums
}

export interface GroupedLedgerAmountSum {
  employeeId: string
  leaveTypeId: string
  entryType: LeaveEntryType
  amount: number
}

/**
 * The bulk counterpart to sumLeaveLedgerAmountsByEntryType — one query
 * covering every employee at once instead of one query per employee, for
 * callers (getOrganizationLeaveDaysSummary) that need the same per-entryType
 * sums for every employee/leaveType pair rather than a single one. Grouping
 * by employeeId+leaveTypeId+entryType in one groupBy is what makes this a
 * single round trip regardless of how many employees exist.
 */
export async function sumLeaveLedgerAmountsByEmployeeAndType(filter: {
  leaveTypeIds: string[]
  asOfDate?: Date
}): Promise<GroupedLedgerAmountSum[]> {
  if (filter.leaveTypeIds.length === 0) return []

  const grouped = await prisma.leaveLedgerEntry.groupBy({
    by: ["employeeId", "leaveTypeId", "entryType"],
    _sum: { amount: true },
    where: {
      leaveTypeId: { in: filter.leaveTypeIds },
      ...(filter.asOfDate ? { effectiveDate: { lte: filter.asOfDate } } : {}),
    },
  })

  return grouped.map((row) => ({
    employeeId: row.employeeId,
    leaveTypeId: row.leaveTypeId,
    entryType: row.entryType,
    amount: row._sum.amount ?? 0,
  }))
}

/** Inserts exactly what's given — does not validate against a policy or
 * compute anything derived. That's Phase 2's job (e.g. a balance-check
 * before allowing LEAVE_TAKEN). Safe for Opening Balance / Manual
 * Adjustment recording today because those are raw data entry, not
 * calculation. */
export function createLeaveLedgerEntry(input: LeaveLedgerEntryInput): Promise<LeaveLedgerEntryModel> {
  return prisma.leaveLedgerEntry.create({
    data: {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      companyId: input.companyId ?? null,
      entryType: input.entryType,
      amount: input.amount,
      unit: input.unit,
      effectiveDate: input.effectiveDate,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      note: input.note ?? null,
      createdBy: input.createdBy,
    },
  })
}
