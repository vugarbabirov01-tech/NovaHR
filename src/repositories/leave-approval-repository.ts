import { prisma } from "@/lib/prisma"
import type { LeaveApprovalModel } from "@/generated/prisma/models"
import type { LeaveApprovalDecision } from "@/generated/prisma/enums"

export type { LeaveApprovalModel as LeaveApproval }

/** sequence exists so a future multi-step engine can insert more rows per
 * request without this table changing shape — Phase 1 (and this decision
 * flow) never writes more than one row per request. decision/decidedAt/
 * comment are optional so a caller can still create the plain PENDING
 * placeholder row the schema defaults to, or record an actual outcome in
 * the same write once one exists. */
export interface LeaveApprovalInput {
  leaveRequestId: string
  sequence?: number
  approverEmployeeId: string
  decision?: LeaveApprovalDecision
  decidedAt?: Date
  comment?: string | null
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
      ...(input.decision ? { decision: input.decision } : {}),
      ...(input.decidedAt ? { decidedAt: input.decidedAt } : {}),
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
    },
  })
}
