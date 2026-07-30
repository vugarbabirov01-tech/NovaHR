import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { ApprovalStepDefinitionModel } from "@/generated/prisma/models"
import type { ApprovalApproverResolutionType, ApprovalQuorumMode } from "@/generated/prisma/enums"

export type { ApprovalStepDefinitionModel as ApprovalStepDefinition }

/**
 * One row per parallel branch per stepOrder (see the schema.prisma model
 * comment for how that expresses "Finance AND HR"). Deleting/updating a
 * step is only ever valid while its parent version is still DRAFT — that
 * invariant belongs to the authoring service, not this repository.
 */
export interface ApprovalStepDefinitionInput {
  workflowVersionId: string
  stepOrder: number
  branchKey?: string
  name: string
  approverResolutionType: ApprovalApproverResolutionType
  approverResolutionConfig?: Prisma.InputJsonValue | null
  quorumMode?: ApprovalQuorumMode
  conditionExpression?: Prisma.InputJsonValue | null
  skipIfNoApproverResolved?: boolean
  /** Non-blocking/advisory branch — see the schema.prisma model comment. */
  isOptional?: boolean
  slaHours?: number | null
  /** Opaque canvas node metadata (position, color, notes) — never
   * interpreted here or by any engine logic. */
  uiMetadata?: Prisma.InputJsonValue | null
}

/** See approval-workflow-definition-repository.ts's toJsonInput for why
 * this distinguishes null (explicit JSON null) from undefined (omit). */
function toJsonInput(value: Prisma.InputJsonValue | null | undefined) {
  if (value === undefined) return undefined
  if (value === null) return Prisma.NullableJsonNullValueInput.JsonNull
  return value
}

function toData(input: ApprovalStepDefinitionInput) {
  return {
    workflowVersionId: input.workflowVersionId,
    stepOrder: input.stepOrder,
    branchKey: input.branchKey ?? "DEFAULT",
    name: input.name,
    approverResolutionType: input.approverResolutionType,
    approverResolutionConfig: toJsonInput(input.approverResolutionConfig),
    quorumMode: input.quorumMode ?? "ANY_ONE",
    conditionExpression: toJsonInput(input.conditionExpression),
    skipIfNoApproverResolved: input.skipIfNoApproverResolved ?? false,
    isOptional: input.isOptional ?? false,
    slaHours: input.slaHours ?? null,
    uiMetadata: toJsonInput(input.uiMetadata),
  } as const
}

/**
 * Both read functions below accept an optional PrismaClientOrTransaction —
 * the Approval Engine (Phase 4C) reads step definitions from inside its
 * own prisma.$transaction while activating/deciding a step. Not about
 * data isolation (published step definitions are immutable) — SQLite's
 * single-connection model can deadlock/error when the plain `prisma`
 * client is queried concurrently with an open interactive transaction on
 * the same connection. Found by running the engine, not by type-checking.
 */
export function findStepDefinitionsByVersion(
  workflowVersionId: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalStepDefinitionModel[]> {
  return client.approvalStepDefinition.findMany({
    where: { workflowVersionId },
    orderBy: [{ stepOrder: "asc" }, { branchKey: "asc" }],
  })
}

export function findStepDefinitionById(
  id: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalStepDefinitionModel | null> {
  return client.approvalStepDefinition.findUnique({ where: { id } })
}

export function createStepDefinition(input: ApprovalStepDefinitionInput): Promise<ApprovalStepDefinitionModel> {
  return prisma.approvalStepDefinition.create({ data: toData(input) })
}

export function updateStepDefinition(
  id: string,
  input: ApprovalStepDefinitionInput
): Promise<ApprovalStepDefinitionModel> {
  return prisma.approvalStepDefinition.update({ where: { id }, data: toData(input) })
}

export function deleteStepDefinition(id: string): Promise<ApprovalStepDefinitionModel> {
  return prisma.approvalStepDefinition.delete({ where: { id } })
}

/**
 * The "save the whole canvas" primitive a drag-and-drop builder needs —
 * one round trip for however many nodes moved/changed, instead of the
 * client sequencing N create/update/delete calls per edit. Whole-collection
 * replace (delete then recreate) rather than diffing row-by-row: the
 * @@unique([workflowVersionId, stepOrder, branchKey]) constraint would
 * otherwise make some reorderings (e.g. swapping two stepOrders)
 * transiently invalid mid-update depending on write order. Runs inside one
 * transaction so a canvas save is atomic — this is the first
 * prisma.$transaction usage in this codebase; the DRAFT-only guard that
 * makes this safe to call lives in the authoring service, not here.
 */
export async function replaceStepDefinitionsForVersion(
  workflowVersionId: string,
  steps: ApprovalStepDefinitionInput[]
): Promise<ApprovalStepDefinitionModel[]> {
  return prisma.$transaction(async (tx) => {
    await tx.approvalStepDefinition.deleteMany({ where: { workflowVersionId } })
    const created: ApprovalStepDefinitionModel[] = []
    for (const step of steps) {
      created.push(await tx.approvalStepDefinition.create({ data: toData({ ...step, workflowVersionId }) }))
    }
    return created
  })
}
