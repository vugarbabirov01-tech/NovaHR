import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { ApprovalInstanceModel } from "@/generated/prisma/models"
import type { ApprovalInstanceStatus } from "@/generated/prisma/enums"
import { computeApprovalInstanceActiveKey, isTerminalInstanceStatus } from "@/lib/approval/approval-state-machine"

export type { ApprovalInstanceModel as ApprovalInstance }

/**
 * The runtime case — one per real-world request, of any entityType. This
 * repository has no idea what a LEAVE_REQUEST or an EXPENSE_REQUEST is; it
 * only ever matches on the plain entityType/entityId strings it's given.
 *
 * Every function accepts an optional PrismaClientOrTransaction so the
 * engine service can compose calls across this and the step-instance/
 * step-approver/action repositories inside one atomic
 * prisma.$transaction — see approval-engine-service.ts. Callers outside a
 * transaction simply omit it and get the default singleton client.
 */
export interface ApprovalInstanceInput {
  entityType: string
  entityId: string
  workflowDefinitionId: string
  workflowVersionId: string
  contextPayload: Prisma.InputJsonValue
  companyId?: string | null
  branchId?: string | null
  departmentId?: string | null
  submittedBy: string
}

export function findActiveApprovalInstanceForEntity(
  entityType: string,
  entityId: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalInstanceModel | null> {
  return client.approvalInstance.findUnique({
    where: { activeKey: computeApprovalInstanceActiveKey(entityType, entityId) },
  })
}

export function findApprovalInstancesForEntity(
  entityType: string,
  entityId: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalInstanceModel[]> {
  return client.approvalInstance.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
  })
}

export function findApprovalInstanceById(
  id: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalInstanceModel | null> {
  return client.approvalInstance.findUnique({ where: { id } })
}

export function findPendingApprovalInstancesForApprover(
  approverEmployeeId: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalInstanceModel[]> {
  return client.approvalInstance.findMany({
    where: {
      stepInstances: {
        some: { approvers: { some: { approverEmployeeId, decision: "PENDING" } }, status: "ACTIVE" },
      },
    },
    orderBy: { submittedAt: "asc" },
  })
}

/**
 * Always created non-terminal (PENDING), so activeKey is always set here —
 * this is what makes a retried submission for the same (entityType,
 * entityId) throw a unique-constraint violation instead of silently
 * creating a second instance. The engine service catches that specific
 * violation and returns the pre-existing instance instead (see
 * submitForApproval's idempotency handling).
 */
export function createApprovalInstance(
  input: ApprovalInstanceInput,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalInstanceModel> {
  return client.approvalInstance.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      workflowDefinitionId: input.workflowDefinitionId,
      workflowVersionId: input.workflowVersionId,
      contextPayload: input.contextPayload,
      companyId: input.companyId ?? null,
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      submittedBy: input.submittedBy,
      status: "PENDING",
      activeKey: computeApprovalInstanceActiveKey(input.entityType, input.entityId),
    },
  })
}

export interface UpdateApprovalInstanceStatusInput {
  /** The status this row is expected to currently be in — the guard that
   * makes this update safe under concurrency/retries (see
   * approval-state-machine.ts). Legality of fromStatus -> toStatus is the
   * caller's responsibility (assertValidInstanceTransition), not this
   * repository's — this only enforces that the row hasn't already moved
   * out from under the caller. */
  fromStatus: ApprovalInstanceStatus
  toStatus: ApprovalInstanceStatus
  currentStepOrder?: number | null
  decidedAt?: Date | null
}

/**
 * A conditional UPDATE ... WHERE status = fromStatus — returns
 * updated:false (and does NOT touch the row) if it's already moved to a
 * different status, which is exactly what happens on a retried call or a
 * concurrent loser. activeKey is cleared automatically whenever toStatus
 * is terminal, and restored (recomputed) whenever a reopen moves a
 * terminal instance back to a non-terminal one — never set directly by a
 * caller.
 */
export async function updateApprovalInstanceStatus(
  id: string,
  input: UpdateApprovalInstanceStatusInput,
  client: PrismaClientOrTransaction = prisma
): Promise<{ updated: boolean; instance: ApprovalInstanceModel | null }> {
  const current = await client.approvalInstance.findUnique({ where: { id } })
  if (!current) return { updated: false, instance: null }

  const result = await client.approvalInstance.updateMany({
    where: { id, status: input.fromStatus },
    data: {
      status: input.toStatus,
      currentStepOrder: input.currentStepOrder === undefined ? undefined : input.currentStepOrder,
      decidedAt: input.decidedAt === undefined ? undefined : input.decidedAt,
      activeKey: isTerminalInstanceStatus(input.toStatus)
        ? null
        : computeApprovalInstanceActiveKey(current.entityType, current.entityId),
    },
  })

  if (result.count === 0) return { updated: false, instance: null }
  const instance = await client.approvalInstance.findUnique({ where: { id } })
  return { updated: true, instance }
}
