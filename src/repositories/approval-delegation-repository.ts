import { prisma } from "@/lib/prisma"
import type { ApprovalDelegationModel } from "@/generated/prisma/models"
import type { ApprovalDelegationReason } from "@/generated/prisma/enums"

export type { ApprovalDelegationModel as ApprovalDelegation }

/**
 * Who stands in for whom, when, and why. scopeEntityType is unconstrained
 * (null = applies to every entity type) — same "no master list" reasoning
 * as ApprovalInstance.entityType (see schema.prisma file header). No
 * resolve-effective-approver logic here — that's the delegation service,
 * out of scope for Phase 4A.
 */
export interface ApprovalDelegationInput {
  delegatorEmployeeId: string
  delegateEmployeeId: string
  reason: ApprovalDelegationReason
  scopeEntityType?: string | null
  startDate: Date
  endDate?: Date | null
  createdBy: string
}

/** Delegations active for this delegator "now", optionally narrowed to one
 * entityType — a delegation with scopeEntityType null always matches. */
export function findActiveDelegationsForEmployee(
  delegatorEmployeeId: string,
  onDate: Date,
  entityType?: string
): Promise<ApprovalDelegationModel[]> {
  return prisma.approvalDelegation.findMany({
    where: {
      delegatorEmployeeId,
      active: true,
      startDate: { lte: onDate },
      AND: [
        { OR: [{ endDate: null }, { endDate: { gte: onDate } }] },
        ...(entityType ? [{ OR: [{ scopeEntityType: null }, { scopeEntityType: entityType }] }] : []),
      ],
    },
  })
}

export function findDelegationById(id: string): Promise<ApprovalDelegationModel | null> {
  return prisma.approvalDelegation.findUnique({ where: { id } })
}

export function createDelegation(input: ApprovalDelegationInput): Promise<ApprovalDelegationModel> {
  return prisma.approvalDelegation.create({
    data: {
      delegatorEmployeeId: input.delegatorEmployeeId,
      delegateEmployeeId: input.delegateEmployeeId,
      reason: input.reason,
      scopeEntityType: input.scopeEntityType ?? null,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      createdBy: input.createdBy,
    },
  })
}

export function deactivateDelegation(id: string): Promise<ApprovalDelegationModel> {
  return prisma.approvalDelegation.update({ where: { id }, data: { active: false } })
}
