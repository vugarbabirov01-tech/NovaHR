import { prisma } from "@/lib/prisma"
import type { LeaveApprovalModel } from "@/generated/prisma/models"

export type { LeaveApprovalModel as LeaveApproval }

/** No decide/update function here — recording an approval decision is
 * workflow logic, explicitly out of scope for this phase. sequence exists
 * so a future multi-step engine can insert more rows per request without
 * this table changing shape. */
export interface LeaveApprovalInput {
  leaveRequestId: string
  sequence?: number
  approverEmployeeId: string
}

export function findLeaveApprovalsByRequest(leaveRequestId: string): Promise<LeaveApprovalModel[]> {
  return prisma.leaveApproval.findMany({
    where: { leaveRequestId },
    orderBy: { sequence: "asc" },
  })
}

export function createLeaveApproval(input: LeaveApprovalInput): Promise<LeaveApprovalModel> {
  return prisma.leaveApproval.create({
    data: {
      leaveRequestId: input.leaveRequestId,
      sequence: input.sequence ?? 1,
      approverEmployeeId: input.approverEmployeeId,
    },
  })
}
