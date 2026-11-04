import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { LeaveRequestModel } from "@/generated/prisma/models"
import type { LeaveRequestLifecycleStatus, LeaveUnit } from "@/generated/prisma/enums"

export type { LeaveRequestModel as LeaveRequest }

/** createLeaveRequest creates a request in whatever status it's given
 * (default DRAFT) — HR-entered leave is created straight into APPROVED
 * (see submitLeaveRequestAction; leave no longer goes through a separate
 * PENDING_APPROVAL decision step), with decidedBy/decidedAt passed
 * alongside status in the same call so the request is never persisted in
 * an inconsistent "APPROVED but never decided" state between two writes.
 * Nothing here transitions a request's status after creation on its own —
 * see updateLeaveRequestDecision below for that (still used by
 * cancelLeaveRequest). */
export interface LeaveRequestInput {
  employeeId: string
  leaveTypeId: string
  companyId?: string | null
  branchId?: string | null
  startDate: Date
  endDate: Date
  requestedUnits: number
  /** The entitlement/work year (e.g. 2025 for "2025–2026") this leave draws
   * its balance from — see LeaveRequest.leavePeriodStartYear's schema
   * comment. Optional only because existing rows predate this field. */
  leavePeriodStartYear?: number | null
  reason?: string | null
  status?: LeaveRequestLifecycleStatus
  decidedBy?: string
  decidedAt?: Date
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

/** Report Builder's LEAVE_REQUESTS data source only — the one reader that
 * needs leaveType.name/code alongside the request, so it includes that
 * relation; findAllLeaveRequests above stays as-is for every existing
 * caller (the /leave dashboard never needed the relation loaded). */
export function findAllLeaveRequestsForReporting() {
  return prisma.leaveRequest.findMany({
    orderBy: { startDate: "desc" },
    include: { leaveType: true },
  })
}

export function findLeaveRequestById(
  id: string,
  client: PrismaClientOrTransaction = prisma
): Promise<LeaveRequestModel | null> {
  return client.leaveRequest.findUnique({ where: { id } })
}

/** Used by the Employee bulk-delete cascade to find which requests need
 * their own dependents (LeaveApproval rows, attached Documents) cleaned up
 * before the requests themselves — and the employees — can go. */
export function findLeaveRequestsByEmployees(
  employeeIds: string[],
  client: PrismaClientOrTransaction = prisma
): Promise<LeaveRequestModel[]> {
  return client.leaveRequest.findMany({ where: { employeeId: { in: employeeIds } } })
}

/** Permanent removal for the same reason as employee-repository.ts's
 * deleteEmployees: employeeId here is a plain string, not a live FK, so
 * deleting the employee alone would leave these orphaned rather than
 * blocked. Callers must delete LeaveApproval rows referencing these
 * requests first (see leave-approval-repository.ts). */
export function deleteLeaveRequestsByEmployees(
  employeeIds: string[],
  client: PrismaClientOrTransaction = prisma
): Promise<{ count: number }> {
  return client.leaveRequest.deleteMany({ where: { employeeId: { in: employeeIds } } })
}

export interface UpcomingApprovedUnitsFilter {
  employeeId?: string
  leaveTypeId?: string
  /** Filters via the related LeaveType's unit — a request itself doesn't
   * store one (see CurrentlyOnLeaveRow's own mapping in the /leave page). */
  unit?: LeaveUnit
  asOfDate: Date
}

/** SUM(requestedUnits) of APPROVED requests whose startDate is still after
 * asOfDate — leave that's already finalized (its LEAVE_TAKEN ledger entry
 * is already written, so it's already reflected in `remaining`) but hasn't
 * started yet. Surfaced as its own figure purely so "what's coming up" has
 * a visible answer, same as the PENDING_APPROVAL sum this replaced once
 * creating a leave request stopped being a separate decision from
 * approving it (see submitLeaveRequestAction) — there's no longer a
 * not-yet-decided state to sum here. */
export async function sumUpcomingApprovedUnits(filter: UpcomingApprovedUnitsFilter): Promise<number> {
  const result = await prisma.leaveRequest.aggregate({
    _sum: { requestedUnits: true },
    where: {
      status: "APPROVED",
      startDate: { gt: filter.asOfDate },
      ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
      ...(filter.leaveTypeId ? { leaveTypeId: filter.leaveTypeId } : {}),
      ...(filter.unit ? { leaveType: { unit: filter.unit } } : {}),
    },
  })
  return result._sum.requestedUnits ?? 0
}

export function createLeaveRequest(
  input: LeaveRequestInput,
  client: PrismaClientOrTransaction = prisma
): Promise<LeaveRequestModel> {
  const status = input.status ?? "DRAFT"
  return client.leaveRequest.create({
    data: {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      companyId: input.companyId ?? null,
      branchId: input.branchId ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      requestedUnits: input.requestedUnits,
      leavePeriodStartYear: input.leavePeriodStartYear ?? null,
      reason: input.reason ?? null,
      status,
      submittedAt: status === "DRAFT" ? null : new Date(),
      decidedBy: input.decidedBy,
      decidedAt: input.decidedAt,
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
 * cancelling only touches cancelledBy/cancelledAt/cancelReason.
 *
 * Unconditional — the caller already read the row and validated its
 * current status just before calling this, so for approve/reject (a
 * single-writer, low-contention path with no live UI calling it today —
 * see leave-request-actions.ts) that's adequate. cancelLeaveRequest uses
 * updateLeaveRequestDecisionIfStatusIn below instead, which doesn't have
 * that read-then-write gap. */
export function updateLeaveRequestDecision(
  id: string,
  input: LeaveRequestDecisionInput,
  client: PrismaClientOrTransaction = prisma
): Promise<LeaveRequestModel> {
  return client.leaveRequest.update({
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

/**
 * Compare-and-swap: only writes if `id`'s CURRENT status is still one of
 * `expectedStatuses` — returns null (writes nothing) if it's already moved
 * on, instead of blindly overwriting whatever decision got there first.
 * This is what makes cancelLeaveRequest safe against two near-simultaneous
 * cancel calls for the same request (e.g. a double-click that got past the
 * UI's own disabled-while-pending guard, or two HR users in different
 * tabs): only one `updateMany` can ever match (SQLite serializes writers,
 * and this still holds under any isolation level since the match is in the
 * WHERE clause, not a separate read), so only one of them proceeds to
 * write the reversing ledger entry — the other sees `null` and the caller
 * surfaces that as a clear "already changed" error rather than silently
 * double-reversing the balance.
 */
export async function updateLeaveRequestDecisionIfStatusIn(
  id: string,
  expectedStatuses: LeaveRequestLifecycleStatus[],
  input: LeaveRequestDecisionInput,
  client: PrismaClientOrTransaction = prisma
): Promise<LeaveRequestModel | null> {
  const result = await client.leaveRequest.updateMany({
    where: { id, status: { in: expectedStatuses } },
    data: {
      status: input.status,
      decidedBy: input.decidedBy,
      decidedAt: input.decidedAt,
      cancelledBy: input.cancelledBy,
      cancelledAt: input.cancelledAt,
      cancelReason: input.cancelReason,
    },
  })
  if (result.count === 0) return null
  return client.leaveRequest.findUniqueOrThrow({ where: { id } })
}
