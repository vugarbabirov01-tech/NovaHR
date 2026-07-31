import {
  findLeaveRequestById,
  updateLeaveRequestDecision,
  type LeaveRequest,
} from "@/repositories/leave-request-repository"
import { createLeaveApproval } from "@/repositories/leave-approval-repository"
import { createLeaveLedgerEntry } from "@/repositories/leave-ledger-repository"
import { findLeaveTypeById } from "@/repositories/leave-type-repository"

/** Every Phase 1/3 write in this module records a fixed actor — no
 * authenticated approver identity exists yet (see leave-audit.ts's own
 * note on RecordLeaveAuditInput.actor). Centralized here so the day a real
 * approver identity exists, this is the one place that changes. */
const DECIDING_ACTOR = "HR"

export interface LeaveRequestDecisionResult {
  leaveRequest: LeaveRequest
}

/**
 * The Pending Leave business rule, end to end (see LeaveBalanceStatement's
 * doc comment and leave-balance-service.ts for the read side):
 *
 *   - PENDING_APPROVAL never touches the ledger — Remaining/Taken are
 *     untouched by a request that's merely pending; it's only counted via
 *     sumPendingRequestedUnits.
 *   - Approving writes a LEAVE_TAKEN ledger entry for the full requested
 *     amount — this is the ONLY point a request ever reduces Remaining.
 *     effectiveDate is the approval instant (now), not the leave's future
 *     startDate — Used Leave must reflect an approval immediately, not
 *     wait until the leave period actually begins.
 *   - Rejecting never writes a ledger entry — there was never anything to
 *     reverse, since submission and pending status wrote nothing either.
 *   - Cancelling a still-pending request also never writes a ledger entry,
 *     for the same reason. Cancelling an already-APPROVED request writes a
 *     LEAVE_CANCELLED entry (positive, reversing the earlier LEAVE_TAKEN)
 *     — this is the one existing bucket in mapEntryTypeSumsToBuckets
 *     (leave-balance-service.ts) explicitly designed for this: "a
 *     cancellation reverses a prior LEAVE_TAKEN".
 *
 * In every case, the moment status stops being PENDING_APPROVAL, the
 * request drops out of sumPendingRequestedUnits automatically — nothing
 * here needs to separately "decrement Pending".
 *
 * No cross-model DB transaction wraps the status update + ledger write
 * (this codebase's Leave repositories aren't wired for
 * PrismaClientOrTransaction the way the Approval Engine's are) — see this
 * change's "remaining risks" note.
 */
export async function approveLeaveRequest(leaveRequestId: string): Promise<LeaveRequestDecisionResult> {
  const request = await findLeaveRequestById(leaveRequestId)
  if (!request) throw new Error("Leave request not found.")
  if (request.status !== "PENDING_APPROVAL") {
    throw new Error(`Only a pending request can be approved (current status: ${request.status}).`)
  }

  const leaveType = await findLeaveTypeById(request.leaveTypeId)
  if (!leaveType) throw new Error("Leave type not found.")

  const decidedAt = new Date()

  const leaveRequest = await updateLeaveRequestDecision(leaveRequestId, {
    status: "APPROVED",
    decidedBy: DECIDING_ACTOR,
    decidedAt,
  })

  await createLeaveLedgerEntry({
    employeeId: request.employeeId,
    leaveTypeId: request.leaveTypeId,
    companyId: request.companyId,
    entryType: "LEAVE_TAKEN",
    amount: -request.requestedUnits,
    unit: leaveType.unit,
    effectiveDate: decidedAt,
    referenceType: "LEAVE_REQUEST",
    referenceId: leaveRequestId,
    createdBy: DECIDING_ACTOR,
  })

  await createLeaveApproval({
    leaveRequestId,
    approverEmployeeId: DECIDING_ACTOR,
    decision: "APPROVED",
    decidedAt,
  })

  return { leaveRequest }
}

export async function rejectLeaveRequest(leaveRequestId: string, reason?: string): Promise<LeaveRequestDecisionResult> {
  const request = await findLeaveRequestById(leaveRequestId)
  if (!request) throw new Error("Leave request not found.")
  if (request.status !== "PENDING_APPROVAL") {
    throw new Error(`Only a pending request can be rejected (current status: ${request.status}).`)
  }

  const decidedAt = new Date()

  // No ledger write — rejecting never had anything to reverse. Rejected
  // requests must never affect Initial/Used/Current Balance.
  const leaveRequest = await updateLeaveRequestDecision(leaveRequestId, {
    status: "REJECTED",
    decidedBy: DECIDING_ACTOR,
    decidedAt,
  })

  await createLeaveApproval({
    leaveRequestId,
    approverEmployeeId: DECIDING_ACTOR,
    decision: "REJECTED",
    decidedAt,
    comment: reason,
  })

  return { leaveRequest }
}

export async function cancelLeaveRequest(leaveRequestId: string, reason?: string): Promise<LeaveRequestDecisionResult> {
  const request = await findLeaveRequestById(leaveRequestId)
  if (!request) throw new Error("Leave request not found.")
  if (request.status !== "PENDING_APPROVAL" && request.status !== "APPROVED") {
    throw new Error(`Only a pending or approved request can be cancelled (current status: ${request.status}).`)
  }

  const wasApproved = request.status === "APPROVED"
  const cancelledAt = new Date()

  const leaveRequest = await updateLeaveRequestDecision(leaveRequestId, {
    status: "CANCELLED",
    cancelledBy: DECIDING_ACTOR,
    cancelledAt,
    cancelReason: reason,
  })

  // Cancelling a still-pending request needs no ledger write — it never
  // had one (status alone is what sumPendingRequestedUnits reads). Only an
  // already-approved request has a LEAVE_TAKEN entry to reverse.
  if (wasApproved) {
    const leaveType = await findLeaveTypeById(request.leaveTypeId)
    if (!leaveType) throw new Error("Leave type not found.")

    await createLeaveLedgerEntry({
      employeeId: request.employeeId,
      leaveTypeId: request.leaveTypeId,
      companyId: request.companyId,
      entryType: "LEAVE_CANCELLED",
      amount: request.requestedUnits,
      unit: leaveType.unit,
      effectiveDate: cancelledAt,
      referenceType: "LEAVE_REQUEST",
      referenceId: leaveRequestId,
      createdBy: DECIDING_ACTOR,
    })
  }

  return { leaveRequest }
}
