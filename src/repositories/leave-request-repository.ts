import { prisma } from "@/lib/prisma"
import type { LeaveRequestModel } from "@/generated/prisma/models"
import type { LeaveRequestLifecycleStatus, LeaveUnit } from "@/generated/prisma/enums"

export type { LeaveRequestModel as LeaveRequest }

/** createLeaveRequest creates a request in whatever status it's given
 * (default DRAFT) — Phase 3B's submission flow passes PENDING_APPROVAL and
 * sets submittedAt; nothing here transitions a request's status after
 * creation on its own. See updateLeaveRequestDecision below for that. */
export interface LeaveRequestInput {
  employeeId: string
  leaveTypeId: string
  companyId?: string | null
  branchId?: string | null
  startDate: Date
  endDate: Date
  requestedUnits: number
  reason?: string | null
  status?: LeaveRequestLifecycleStatus
}

export function findLeaveRequestsByEmployee(employeeId: string): Promise<LeaveRequestModel[]> {
  return prisma.leaveRequest.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" } })
}

/** Cross-employee — the HR-facing /leave dashboard's one read query.
 * findLeaveRequestsByEmployee above stays employee-scoped for the
 * Employee Profile tab; this is the org-wide counterpart over the same
 * table, same shape, no separate model or logic. */
export function findAllLeaveRequests(): Promise<LeaveRequestModel[]> {
  return prisma.leaveRequest.findMany({ orderBy: { createdAt: "desc" } })
}

export function findLeaveRequestById(id: string): Promise<LeaveRequestModel | null> {
  return prisma.leaveRequest.findUnique({ where: { id } })
}

export interface PendingRequestedUnitsFilter {
  employeeId?: string
  leaveTypeId?: string
  /** Filters via the related LeaveType's unit — a request itself doesn't
   * store one (see CurrentlyOnLeaveRow's own mapping in the /leave page). */
  unit?: LeaveUnit
}

/** SUM(requestedUnits) of PENDING_APPROVAL requests — never reduces a
 * ledger-derived balance (submitting writes no ledger row), so this is
 * surfaced as its own figure rather than folded into `remaining`. */
export async function sumPendingRequestedUnits(filter: PendingRequestedUnitsFilter): Promise<number> {
  const result = await prisma.leaveRequest.aggregate({
    _sum: { requestedUnits: true },
    where: {
      status: "PENDING_APPROVAL",
      ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
      ...(filter.leaveTypeId ? { leaveTypeId: filter.leaveTypeId } : {}),
      ...(filter.unit ? { leaveType: { unit: filter.unit } } : {}),
    },
  })
  return result._sum.requestedUnits ?? 0
}

export function createLeaveRequest(input: LeaveRequestInput): Promise<LeaveRequestModel> {
  const status = input.status ?? "DRAFT"
  return prisma.leaveRequest.create({
    data: {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      companyId: input.companyId ?? null,
      branchId: input.branchId ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      requestedUnits: input.requestedUnits,
      reason: input.reason ?? null,
      status,
      submittedAt: status === "DRAFT" ? null : new Date(),
    },
  })
}

export interface LeaveRequestDecisionInput {
  status: LeaveRequestLifecycleStatus
  decidedBy?: string
  decidedAt?: Date
  cancelledBy?: string
  cancelledAt?: Date
  cancelReason?: string
}

/** Mechanical write only — approveLeaveRequestAction/rejectLeaveRequestAction
 * /cancelLeaveRequestAction (leave-request-decision-service.ts) own the
 * actual business rules (which transitions are legal, whether a ledger
 * entry accompanies this). This just persists whatever decision the caller
 * already validated. Undefined fields are omitted from the update (Prisma's
 * own semantics), so approving only touches decidedBy/decidedAt and
 * cancelling only touches cancelledBy/cancelledAt/cancelReason. */
export function updateLeaveRequestDecision(
  id: string,
  input: LeaveRequestDecisionInput
): Promise<LeaveRequestModel> {
  return prisma.leaveRequest.update({
    where: { id },
    data: {
      status: input.status,
      decidedBy: input.decidedBy,
      decidedAt: input.decidedAt,
      cancelledBy: input.cancelledBy,
      cancelledAt: input.cancelledAt,
      cancelReason: input.cancelReason,
    },
  })
}
