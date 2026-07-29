import { prisma } from "@/lib/prisma"
import type { LeaveRequestModel } from "@/generated/prisma/models"
import type { LeaveRequestLifecycleStatus } from "@/generated/prisma/enums"

export type { LeaveRequestModel as LeaveRequest }

/** No update/approve/reject function here on purpose — deciding a request
 * is workflow logic, explicitly out of scope for this phase. createLeaveRequest
 * creates a request in whatever status it's given (default DRAFT) —
 * Phase 3B's submission flow passes PENDING_APPROVAL and sets submittedAt;
 * nothing here transitions a request's status after creation. */
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

export function findLeaveRequestById(id: string): Promise<LeaveRequestModel | null> {
  return prisma.leaveRequest.findUnique({ where: { id } })
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
