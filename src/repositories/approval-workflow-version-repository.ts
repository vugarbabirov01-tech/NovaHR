import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { ApprovalWorkflowVersionModel } from "@/generated/prisma/models"

export type { ApprovalWorkflowVersionModel as ApprovalWorkflowVersion }

/**
 * Immutable once PUBLISHED (enforced by the authoring service, not this
 * repository — Phase 4A is read/write primitives only). A published version
 * is never updated in place; editing means creating a new DRAFT version via
 * createWorkflowVersion with the next version number.
 */
export interface ApprovalWorkflowVersionInput {
  workflowDefinitionId: string
  version: number
  defaultSlaHours?: number | null
  createdBy: string
}

/** See approval-workflow-definition-repository.ts's toJsonInput for why
 * this distinguishes null (explicit JSON null) from undefined (omit). */
function toJsonInput(value: Prisma.InputJsonValue | null | undefined) {
  if (value === undefined) return undefined
  if (value === null) return Prisma.NullableJsonNullValueInput.JsonNull
  return value
}

export function findWorkflowVersionsByDefinition(
  workflowDefinitionId: string
): Promise<ApprovalWorkflowVersionModel[]> {
  return prisma.approvalWorkflowVersion.findMany({
    where: { workflowDefinitionId },
    orderBy: { version: "desc" },
  })
}

export function findPublishedWorkflowVersion(
  workflowDefinitionId: string
): Promise<ApprovalWorkflowVersionModel | null> {
  return prisma.approvalWorkflowVersion.findFirst({
    where: { workflowDefinitionId, status: "PUBLISHED" },
    orderBy: { version: "desc" },
  })
}

export function findDraftWorkflowVersion(
  workflowDefinitionId: string
): Promise<ApprovalWorkflowVersionModel | null> {
  return prisma.approvalWorkflowVersion.findFirst({
    where: { workflowDefinitionId, status: "DRAFT" },
    orderBy: { version: "desc" },
  })
}

/**
 * Accepts an optional PrismaClientOrTransaction — unlike the rest of this
 * file, because the Approval Engine (Phase 4C) reads a version's
 * defaultSlaHours from inside its own prisma.$transaction while
 * activating a step. This isn't about data isolation (a PUBLISHED
 * version's row never changes) — it's that SQLite's single-connection
 * model can deadlock/error when a query on the plain `prisma` client runs
 * concurrently with an open interactive transaction on the same
 * connection. Found by actually running the engine, not by type-checking.
 */
export function findWorkflowVersionById(
  id: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalWorkflowVersionModel | null> {
  return client.approvalWorkflowVersion.findUnique({ where: { id } })
}

/** The most recent version regardless of status — what cloning (as
 * opposed to publishing) starts from. */
export function findLatestWorkflowVersion(workflowDefinitionId: string): Promise<ApprovalWorkflowVersionModel | null> {
  return prisma.approvalWorkflowVersion.findFirst({
    where: { workflowDefinitionId },
    orderBy: { version: "desc" },
  })
}

export function createWorkflowVersion(input: ApprovalWorkflowVersionInput): Promise<ApprovalWorkflowVersionModel> {
  return prisma.approvalWorkflowVersion.create({
    data: {
      workflowDefinitionId: input.workflowDefinitionId,
      version: input.version,
      defaultSlaHours: input.defaultSlaHours ?? null,
      createdBy: input.createdBy,
    },
  })
}

export function publishWorkflowVersion(id: string, publishedBy: string): Promise<ApprovalWorkflowVersionModel> {
  return prisma.approvalWorkflowVersion.update({
    where: { id },
    data: { status: "PUBLISHED", publishedBy, publishedAt: new Date() },
  })
}

export function archiveWorkflowVersion(id: string): Promise<ApprovalWorkflowVersionModel> {
  return prisma.approvalWorkflowVersion.update({ where: { id }, data: { status: "ARCHIVED" } })
}

/** Canvas-level presentation state (viewport/zoom/pan) only — never
 * touches status/steps. A future visual builder calls this on every
 * pan/zoom without going through the step-mutation DRAFT guard, since
 * viewing a published version's read-only canvas is not "editing" it. */
export function updateWorkflowVersionCanvasMetadata(
  id: string,
  canvasMetadata: Prisma.InputJsonValue | null
): Promise<ApprovalWorkflowVersionModel> {
  return prisma.approvalWorkflowVersion.update({
    where: { id },
    data: { canvasMetadata: toJsonInput(canvasMetadata) },
  })
}
