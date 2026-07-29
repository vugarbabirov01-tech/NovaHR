"use server"

import {
  createLeaveLedgerEntry as createLeaveLedgerEntryRepo,
  type LeaveLedgerEntry,
} from "@/repositories/leave-ledger-repository"
import { leaveLedgerEntryInputSchema } from "@/lib/validation/leave"
import { LeaveAuditAction, LeaveAuditEntityType, recordLeaveAudit } from "@/lib/leave/leave-audit"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"

/**
 * The one write path onto the ledger in Phase 1. Inserts exactly what's
 * given — does not validate against a LeavePolicy, does not check an
 * existing balance, does not compute anything derived. That narrowness is
 * what makes it safe to ship now: recording an Opening Balance import row or
 * a Manual Adjustment is raw, audited data entry, not the "leave
 * calculation" this phase explicitly defers (accrual, carry-forward,
 * expiry, and balance-checked LEAVE_TAKEN entries all still require
 * business logic that doesn't exist yet).
 */
export async function recordLeaveLedgerEntryAction(
  input: unknown
): Promise<MasterDataActionResult<LeaveLedgerEntry>> {
  const parsed = leaveLedgerEntryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  let entry: LeaveLedgerEntry
  try {
    entry = await createLeaveLedgerEntryRepo({
      ...parsed.data,
      effectiveDate: new Date(parsed.data.effectiveDate),
    })
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.LeaveLedgerEntry,
      entityId: entry.id,
      action: LeaveAuditAction.LeaveLedgerEntryRecorded,
      actor: parsed.data.createdBy,
      field: "entryType",
      newValue: parsed.data.entryType,
    })
  } catch {
    return { success: false, error: "Could not record ledger entry." }
  }
  return { success: true, data: entry }
}
