import { prisma } from "@/lib/prisma"
import type { LeaveAccrualRunModel } from "@/generated/prisma/models"

export type { LeaveAccrualRunModel as LeaveAccrualRun }

/**
 * Execution-log placeholder — records that an accrual batch ran (or is
 * scheduled to) and how many ledger entries it produced. No accrual
 * calculation exists yet; nothing currently calls createLeaveAccrualRun.
 * This file only gives Phase 2's accrual engine somewhere to log to from
 * day one, without this table needing to be designed then.
 */
export interface LeaveAccrualRunInput {
  leavePolicyId: string
  periodStart: Date
  periodEnd: Date
}

export function findLeaveAccrualRunsByPolicy(leavePolicyId: string): Promise<LeaveAccrualRunModel[]> {
  return prisma.leaveAccrualRun.findMany({
    where: { leavePolicyId },
    orderBy: { periodStart: "desc" },
  })
}

export function findLeaveAccrualRunById(id: string): Promise<LeaveAccrualRunModel | null> {
  return prisma.leaveAccrualRun.findUnique({ where: { id } })
}

export function createLeaveAccrualRun(input: LeaveAccrualRunInput): Promise<LeaveAccrualRunModel> {
  return prisma.leaveAccrualRun.create({
    data: {
      leavePolicyId: input.leavePolicyId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: "PENDING",
    },
  })
}
