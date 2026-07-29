"use server"

import { computeLeaveBalance, getEmployeeLeaveSummary } from "@/lib/leave/leave-balance-service"
import { findActiveLeaveTypes, type LeaveType } from "@/repositories/leave-type-repository"
import {
  findLeaveLedgerEntriesByEmployee,
  type LeaveLedgerEntry,
} from "@/repositories/leave-ledger-repository"
import type { LeaveBalanceStatement } from "@/types/leave"

/**
 * The Employee Leave Summary endpoint — one balance statement per active
 * leave type, always reconstructed from the ledger via
 * leave-balance-service.ts. Thin on purpose: no business logic here, only
 * input handling and delegation, same shape as every other action file in
 * this module.
 */
export async function getEmployeeLeaveSummaryAction(
  employeeId: string,
  asOfDate?: string
): Promise<LeaveBalanceStatement[]> {
  return getEmployeeLeaveSummary(employeeId, asOfDate ? new Date(asOfDate) : new Date())
}

/** Single-type variant, for a future consumer that only needs one balance
 * rather than the full per-employee summary. */
export async function getLeaveBalanceForTypeAction(
  employeeId: string,
  leaveTypeId: string,
  asOfDate?: string
): Promise<LeaveBalanceStatement> {
  return computeLeaveBalance(employeeId, leaveTypeId, asOfDate ? new Date(asOfDate) : new Date())
}

/**
 * Raw ledger rows for the Transaction History section — sorted newest-first
 * for display. The repository's own findLeaveLedgerEntriesByEmployee stays
 * ascending (Phase 1's contract, used as-is by the balance service where
 * order doesn't matter for a sum); reversing for display is a presentation
 * concern, so it happens here, not in the repository.
 */
export async function getLeaveTransactionHistoryAction(
  employeeId: string,
  leaveTypeId?: string
): Promise<LeaveLedgerEntry[]> {
  const entries = await findLeaveLedgerEntriesByEmployee(employeeId, leaveTypeId)
  return [...entries].reverse()
}

export async function getActiveLeaveTypesAction(): Promise<LeaveType[]> {
  return findActiveLeaveTypes()
}
