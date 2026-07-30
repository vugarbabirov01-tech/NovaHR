import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { ApprovalStepInstanceModel } from "@/generated/prisma/models"
import type { ApprovalStepInstanceStatus } from "@/generated/prisma/enums"

export type { ApprovalStepInstanceModel as ApprovalStepInstance }

/**
 * Runtime state of one branch of one ApprovalInstance. createStepInstance
 * always starts PENDING — every later transition (including straight to
 * SKIPPED) goes through the one guarded updateStepInstanceStatus path, so
 * there is exactly one code path for "how does a step instance's status
 * ever change," never a shortcut that bypasses the transition guard.
 *
 * Every function accepts an optional PrismaClientOrTransaction for the
 * same reason as approval-instance-repository.ts — the engine composes
 * these calls inside one prisma.$transaction.
 */
export interface ApprovalStepInstanceInput {
  approvalInstanceId: string
  stepDefinitionId: string
  stepOrder: number
  branchKey: string
}

export function findStepInstancesByApprovalInstance(
  approvalInstanceId: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalStepInstanceModel[]> {
  return client.approvalStepInstance.findMany({
    where: { approvalInstanceId },
    orderBy: [{ stepOrder: "asc" }, { branchKey: "asc" }],
  })
}

export function findActiveStepInstances(
  approvalInstanceId: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalStepInstanceModel[]> {
  return client.approvalStepInstance.findMany({
    where: { approvalInstanceId, status: "ACTIVE" },
  })
}

export function findStepInstanceById(
  id: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalStepInstanceModel | null> {
  return client.approvalStepInstance.findUnique({ where: { id } })
}

/** Every ACTIVE step instance whose dueAt has passed — the future
 * escalation sweep's one query. Safe to query without joining through to
 * the parent instance's status: the engine's own invariant (an instance is
 * never terminal while any of its step instances are still ACTIVE) means
 * an ACTIVE row here always belongs to a still-open instance by
 * construction — see approval-engine-service.ts's cancel/reject paths. */
export function findOverdueStepInstances(
  asOf: Date,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalStepInstanceModel[]> {
  return client.approvalStepInstance.findMany({
    where: { status: "ACTIVE", dueAt: { lt: asOf } },
  })
}

export function createStepInstance(
  input: ApprovalStepInstanceInput,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalStepInstanceModel> {
  return client.approvalStepInstance.create({
    data: {
      approvalInstanceId: input.approvalInstanceId,
      stepDefinitionId: input.stepDefinitionId,
      stepOrder: input.stepOrder,
      branchKey: input.branchKey,
    },
  })
}

export interface UpdateStepInstanceStatusInput {
  /** Expected current status — the same compare-and-swap guard as
   * approval-instance-repository.ts's updateApprovalInstanceStatus, for
   * the same reason (concurrent decisions on the same step must not both
   * think they're the one advancing it). */
  fromStatus: ApprovalStepInstanceStatus
  toStatus: ApprovalStepInstanceStatus
  activatedAt?: Date | null
  dueAt?: Date | null
  decidedAt?: Date | null
  /** Only meaningful when toStatus is SKIPPED — see the schema.prisma
   * model comment for the vocabulary. */
  skipReason?: string | null
  escalationLevel?: number
}

export async function updateStepInstanceStatus(
  id: string,
  input: UpdateStepInstanceStatusInput,
  client: PrismaClientOrTransaction = prisma
): Promise<{ updated: boolean; stepInstance: ApprovalStepInstanceModel | null }> {
  const result = await client.approvalStepInstance.updateMany({
    where: { id, status: input.fromStatus },
    data: {
      status: input.toStatus,
      activatedAt: input.activatedAt === undefined ? undefined : input.activatedAt,
      dueAt: input.dueAt === undefined ? undefined : input.dueAt,
      decidedAt: input.decidedAt === undefined ? undefined : input.decidedAt,
      skipReason: input.skipReason === undefined ? undefined : input.skipReason,
      escalationLevel: input.escalationLevel,
    },
  })

  if (result.count === 0) return { updated: false, stepInstance: null }
  const stepInstance = await client.approvalStepInstance.findUnique({ where: { id } })
  return { updated: true, stepInstance }
}
