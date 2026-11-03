import { prisma } from "@/lib/prisma"
import {
  createLeaveRequest,
  findLeaveRequestById,
  updateLeaveRequestDecision,
  updateLeaveRequestDecisionIfStatusIn,
  type LeaveRequest,
} from "@/repositories/leave-request-repository"
import { createLeaveApproval } from "@/repositories/leave-approval-repository"
import { createLeaveLedgerEntry } from "@/repositories/leave-ledger-repository"
import { findLeaveTypeById } from "@/repositories/leave-type-repository"
import { LeaveAuditAction, LeaveAuditEntityType, recordLeaveAudit } from "@/lib/leave/leave-audit"
import type { LeaveRequestLifecycleStatus } from "@/generated/prisma/enums"

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
 *   - Creating a request now IS approving it (createApprovedLeaveRequest,
 *     below) — HR entering a leave is the decision; there's no separate
 *     not-yet-decided state for a new request to sit in. Its LEAVE_TAKEN
 *     ledger entry, status, and audit entry all land in one DB transaction
 *     — either every write commits or none do, never a request that exists
 *     with no corresponding ledger entry (or vice versa).
 *   - Cancelling a request reverses it: cancelling a request that's
 *     APPROVED (true of every request created after this change) writes a
 *     LEAVE_CANCELLED entry (positive, reversing the earlier LEAVE_TAKEN)
 *     — this is the one existing bucket in mapEntryTypeSumsToBuckets
 *     (leave-balance-service.ts) explicitly designed for this: "a
 *     cancellation reverses a prior LEAVE_TAKEN". Same transactional
 *     guarantee as creation, plus a compare-and-swap status update
 *     (updateLeaveRequestDecisionIfStatusIn) so two near-simultaneous
 *     cancels of the same request can't both "win" and both write a
 *     reversal.
 *   - approveLeaveRequest/rejectLeaveRequest below remain for a request
 *     that's still PENDING_APPROVAL (a status nothing creates anymore, but
 *     a historical or manually-inserted row could still be in) — their own
 *     transactional handling is a smaller, separate concern from
 *     create/cancel's and intentionally out of this change's scope; see
 *     their own doc comments.
 */
export interface CreateApprovedLeaveRequestInput {
  employeeId: string
  leaveTypeId: string
  companyId?: string | null
  branchId?: string | null
  startDate: Date
  endDate: Date
  requestedUnits: number
  leavePeriodStartYear?: number | null
  reason?: string | null
}

export async function createApprovedLeaveRequest(
  input: CreateApprovedLeaveRequestInput
): Promise<LeaveRequestDecisionResult> {
  const leaveType = await findLeaveTypeById(input.leaveTypeId)
  if (!leaveType) throw new Error("Leave type not found.")

  const decidedAt = new Date()

  const leaveRequest = await prisma.$transaction(async (tx) => {
    const created = await createLeaveRequest(
      {
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        companyId: input.companyId ?? null,
        branchId: input.branchId ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        requestedUnits: input.requestedUnits,
        leavePeriodStartYear: input.leavePeriodStartYear,
        reason: input.reason ?? null,
        status: "APPROVED",
        decidedBy: DECIDING_ACTOR,
        decidedAt,
      },
      tx
    )

    await createLeaveLedgerEntry(
      {
        employeeId: created.employeeId,
        leaveTypeId: created.leaveTypeId,
        companyId: created.companyId,
        entryType: "LEAVE_TAKEN",
        amount: -created.requestedUnits,
        unit: leaveType.unit,
        effectiveDate: decidedAt,
        referenceType: "LEAVE_REQUEST",
        referenceId: created.id,
        createdBy: DECIDING_ACTOR,
      },
      tx
    )

    await recordLeaveAudit(
      {
        entityType: LeaveAuditEntityType.LeaveRequest,
        entityId: created.id,
        action: LeaveAuditAction.LeaveRequestCreated,
        actor: DECIDING_ACTOR,
      },
      tx
    )

    return created
  })

  return { leaveRequest }
}

/**
 * The only place a PENDING_APPROVAL request becomes APPROVED the "old" way
 * (a separate decision after creation) — writes the same LEAVE_TAKEN
 * ledger entry createApprovedLeaveRequest's transaction writes at creation
 * time now. Nothing creates a PENDING_APPROVAL request anymore (see
 * createApprovedLeaveRequest above), so this has no live caller today —
 * kept for a request that's still in that state from before this change,
 * not deleted on the chance one surfaces again. Deliberately left without
 * this file's new transactional/compare-and-swap handling: tightening this
 * one too is a smaller, separate change from create/cancel, which is what
 * was asked for here.
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

const CANCELLABLE_STATUSES: LeaveRequestLifecycleStatus[] = ["PENDING_APPROVAL", "APPROVED"]

/**
 * Status change, (conditional) reversing ledger entry, and audit entry all
 * land in one DB transaction — either every write commits or none do. The
 * status update is a compare-and-swap (updateLeaveRequestDecisionIfStatusIn)
 * against the exact status this call itself just read, not a blind
 * `UPDATE ... WHERE id = ?`: if two cancel calls for the same request
 * somehow overlap (a double-click that got past the UI's disabled-while-
 * pending guard, two HR users in different tabs), only one's conditional
 * update can match — the other gets `null` back and this throws, instead
 * of both proceeding to write a LEAVE_CANCELLED reversal each.
 */
export async function cancelLeaveRequest(leaveRequestId: string, reason?: string): Promise<LeaveRequestDecisionResult> {
  const request = await findLeaveRequestById(leaveRequestId)
  if (!request) throw new Error("Leave request not found.")
  if (!CANCELLABLE_STATUSES.includes(request.status)) {
    throw new Error(`Only a pending or approved request can be cancelled (current status: ${request.status}).`)
  }

  const wasApproved = request.status === "APPROVED"
  const cancelledAt = new Date()

  // Resolved before entering the transaction — failing on a missing leave
  // type shouldn't happen mid-write, and this never changes the outcome
  // (findLeaveTypeById is a plain read with no interleaving write to race).
  const leaveType = wasApproved ? await findLeaveTypeById(request.leaveTypeId) : null
  if (wasApproved && !leaveType) throw new Error("Leave type not found.")

  const leaveRequest = await prisma.$transaction(async (tx) => {
    const updated = await updateLeaveRequestDecisionIfStatusIn(
      leaveRequestId,
      [request.status],
      { status: "CANCELLED", cancelledBy: DECIDING_ACTOR, cancelledAt, cancelReason: reason },
      tx
    )
    if (!updated) {
      throw new Error(
        "This leave request was already changed by another operation. Refresh and try again."
      )
    }

    // Cancelling a still-pending request needs no ledger write — it never
    // had one. Only an already-approved request has a LEAVE_TAKEN entry to
    // reverse.
    if (wasApproved && leaveType) {
      await createLeaveLedgerEntry(
        {
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
        },
        tx
      )
    }

    await recordLeaveAudit(
      {
        entityType: LeaveAuditEntityType.LeaveRequest,
        entityId: leaveRequestId,
        action: LeaveAuditAction.LeaveRequestCancelled,
        actor: DECIDING_ACTOR,
        field: "status",
        oldValue: request.status,
        newValue: "CANCELLED",
      },
      tx
    )

    return updated
  })

  return { leaveRequest }
}
