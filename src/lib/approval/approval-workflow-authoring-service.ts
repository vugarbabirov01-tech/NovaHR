import { Prisma } from "@/generated/prisma/client"
import {
  createWorkflowDefinition,
  findWorkflowDefinitionById,
  updateWorkflowDefinition,
  archiveWorkflowDefinition as archiveWorkflowDefinitionRepo,
  restoreWorkflowDefinition as restoreWorkflowDefinitionRepo,
  type ApprovalWorkflowDefinition,
  type ApprovalWorkflowDefinitionInput,
  type ApprovalWorkflowDefinitionUpdateInput,
} from "@/repositories/approval-workflow-definition-repository"
import {
  createWorkflowVersion,
  findLatestWorkflowVersion,
  findWorkflowVersionById,
  findPublishedWorkflowVersion,
  publishWorkflowVersion as publishWorkflowVersionRepo,
  archiveWorkflowVersion,
  updateWorkflowVersionCanvasMetadata as updateWorkflowVersionCanvasMetadataRepo,
  type ApprovalWorkflowVersion,
} from "@/repositories/approval-workflow-version-repository"
import {
  findStepDefinitionsByVersion,
  createStepDefinition,
  updateStepDefinition as updateStepDefinitionRepo,
  deleteStepDefinition as deleteStepDefinitionRepo,
  replaceStepDefinitionsForVersion,
  type ApprovalStepDefinition,
  type ApprovalStepDefinitionInput,
} from "@/repositories/approval-step-definition-repository"
import {
  ApprovalWorkflowAuditAction,
  ApprovalWorkflowAuditEntityType,
  recordApprovalWorkflowAudit,
} from "@/lib/approval/approval-workflow-audit"

/**
 * Owns the Definition + Version + Step aggregate cluster as one service —
 * steps can't be safely mutated without version-lifecycle awareness (the
 * DRAFT guard below), so splitting this into three disconnected services
 * would just push that coupling onto every caller instead of centralizing
 * it here. Nothing in this file references Leave, Document, or any other
 * business module — see the schema.prisma file header for why entityType
 * stays a free string with no registry even here.
 */

function draftGuardError(): Error {
  return new Error(
    "Cannot modify a published or archived workflow version. Clone it into a new draft first."
  )
}

async function requireDraftVersion(versionId: string): Promise<ApprovalWorkflowVersion> {
  const version = await findWorkflowVersionById(versionId)
  if (!version) throw new Error("Workflow version not found.")
  if (version.status !== "DRAFT") throw draftGuardError()
  return version
}

/** Defense-in-depth ahead of the DB's own
 * @@unique([workflowVersionId, stepOrder, branchKey]) — gives the caller a
 * clear validation error instead of a raw constraint failure. Takes only
 * the two fields it needs (not the full input/model type) so it can check
 * a mix of already-persisted steps and not-yet-created ones, e.g. in
 * createDraftStep. */
function assertNoDuplicateStepKeys(steps: { stepOrder: number; branchKey?: string | null }[]): void {
  const seen = new Set<string>()
  for (const step of steps) {
    const key = `${step.stepOrder}::${step.branchKey ?? "DEFAULT"}`
    if (seen.has(key)) {
      throw new Error(
        `Duplicate step at stepOrder ${step.stepOrder}, branch "${step.branchKey ?? "DEFAULT"}" — each stepOrder/branch pair must be unique within a version.`
      )
    }
    seen.add(key)
  }
}

export interface CreateWorkflowDefinitionInput extends ApprovalWorkflowDefinitionInput {
  defaultSlaHours?: number | null
}

export interface WorkflowDefinitionWithVersion {
  definition: ApprovalWorkflowDefinition
  version: ApprovalWorkflowVersion
}

/**
 * The primary creation entrypoint — a workflow is never useful without at
 * least a version to hold its (possibly still-empty) step graph, so this
 * bundles both rather than leaving callers to manage that intermediate
 * state themselves. Mirrors how a visual builder's "New Workflow" action
 * would immediately need a version id to save the canvas against.
 */
export async function createWorkflowDefinitionWithDraftVersion(
  input: CreateWorkflowDefinitionInput
): Promise<WorkflowDefinitionWithVersion> {
  const definition = await createWorkflowDefinition(input)
  const version = await createWorkflowVersion({
    workflowDefinitionId: definition.id,
    version: 1,
    defaultSlaHours: input.defaultSlaHours ?? null,
    createdBy: input.createdBy,
  })

  await recordApprovalWorkflowAudit({
    entityType: ApprovalWorkflowAuditEntityType.WorkflowDefinition,
    entityId: definition.id,
    action: ApprovalWorkflowAuditAction.DefinitionCreated,
    actor: input.createdBy,
  })
  await recordApprovalWorkflowAudit({
    entityType: ApprovalWorkflowAuditEntityType.WorkflowVersion,
    entityId: version.id,
    action: ApprovalWorkflowAuditAction.VersionCreated,
    actor: input.createdBy,
  })

  return { definition, version }
}

export interface WorkflowVersionDetail {
  definition: ApprovalWorkflowDefinition
  version: ApprovalWorkflowVersion
  steps: ApprovalStepDefinition[]
}

/** The one "load the canvas" call — a future visual builder fetches
 * everything it needs to render in a single round trip. */
export async function getWorkflowVersionDetail(versionId: string): Promise<WorkflowVersionDetail> {
  const version = await findWorkflowVersionById(versionId)
  if (!version) throw new Error("Workflow version not found.")
  const definition = await findWorkflowDefinitionById(version.workflowDefinitionId)
  if (!definition) throw new Error("Workflow definition not found.")
  const steps = await findStepDefinitionsByVersion(versionId)
  return { definition, version, steps }
}

/**
 * Definition metadata (name/description/scope/matching condition/
 * priority/isTemplate) is mutable in place, independent of any version's
 * DRAFT/PUBLISHED status — it only affects which definition a *future*
 * submission resolves to, never an in-flight instance's already-pinned
 * step graph (that's workflowVersionId, untouched by this). See the
 * self-review's point 2 for the full reasoning.
 */
export async function updateWorkflowDefinitionMetadata(
  definitionId: string,
  input: ApprovalWorkflowDefinitionUpdateInput,
  actor: string
): Promise<ApprovalWorkflowDefinition> {
  const definition = await updateWorkflowDefinition(definitionId, input)
  await recordApprovalWorkflowAudit({
    entityType: ApprovalWorkflowAuditEntityType.WorkflowDefinition,
    entityId: definition.id,
    action: ApprovalWorkflowAuditAction.DefinitionUpdated,
    actor,
  })
  return definition
}

/**
 * The "save the whole canvas" operation a drag-and-drop builder calls once
 * per Save click, instead of sequencing N create/update/delete requests.
 * Whole-collection replace, guarded to DRAFT versions only.
 */
export async function replaceDraftSteps(
  versionId: string,
  steps: ApprovalStepDefinitionInput[],
  actor: string
): Promise<ApprovalStepDefinition[]> {
  await requireDraftVersion(versionId)
  assertNoDuplicateStepKeys(steps)

  const result = await replaceStepDefinitionsForVersion(versionId, steps)

  await recordApprovalWorkflowAudit({
    entityType: ApprovalWorkflowAuditEntityType.WorkflowVersion,
    entityId: versionId,
    action: ApprovalWorkflowAuditAction.VersionStepsReplaced,
    actor,
    field: "batch",
    newValue: String(result.length),
  })

  return result
}

/** Granular single-step create — for non-visual/scripted callers; a
 * visual builder normally uses replaceDraftSteps instead. */
export async function createDraftStep(
  versionId: string,
  step: ApprovalStepDefinitionInput,
  actor: string
): Promise<ApprovalStepDefinition> {
  await requireDraftVersion(versionId)
  const existing = await findStepDefinitionsByVersion(versionId)
  const candidate = { ...step, workflowVersionId: versionId }
  assertNoDuplicateStepKeys([...existing, candidate])

  const created = await createStepDefinition(candidate)

  await recordApprovalWorkflowAudit({
    entityType: ApprovalWorkflowAuditEntityType.WorkflowVersion,
    entityId: versionId,
    action: ApprovalWorkflowAuditAction.VersionStepsReplaced,
    actor,
    field: "create",
    newValue: created.id,
  })

  return created
}

export async function updateDraftStep(
  stepId: string,
  step: ApprovalStepDefinitionInput,
  actor: string
): Promise<ApprovalStepDefinition> {
  const existingSteps = await findStepDefinitionsByVersion(step.workflowVersionId)
  const target = existingSteps.find((s) => s.id === stepId)
  if (!target) throw new Error("Step not found.")
  await requireDraftVersion(target.workflowVersionId)

  const updated = await updateStepDefinitionRepo(stepId, step)

  await recordApprovalWorkflowAudit({
    entityType: ApprovalWorkflowAuditEntityType.WorkflowVersion,
    entityId: target.workflowVersionId,
    action: ApprovalWorkflowAuditAction.VersionStepsReplaced,
    actor,
    field: "update",
    newValue: updated.id,
  })

  return updated
}

export async function deleteDraftStep(stepId: string, workflowVersionId: string, actor: string): Promise<void> {
  await requireDraftVersion(workflowVersionId)
  await deleteStepDefinitionRepo(stepId)

  await recordApprovalWorkflowAudit({
    entityType: ApprovalWorkflowAuditEntityType.WorkflowVersion,
    entityId: workflowVersionId,
    action: ApprovalWorkflowAuditAction.VersionStepsReplaced,
    actor,
    field: "delete",
    newValue: stepId,
  })
}

/** Presentation-only — a canvas pan/zoom is not "editing" the workflow, so
 * this deliberately does NOT go through the DRAFT guard: it's valid to
 * reposition how a PUBLISHED (read-only) version's canvas is viewed. */
export async function updateWorkflowVersionCanvasMetadata(
  versionId: string,
  canvasMetadata: Prisma.InputJsonValue | null
): Promise<ApprovalWorkflowVersion> {
  return updateWorkflowVersionCanvasMetadataRepo(versionId, canvasMetadata)
}

/**
 * DRAFT -> PUBLISHED, one-way. Supersedes (archives) any previously
 * PUBLISHED version of the same definition, so exactly one PUBLISHED
 * version is ever active at a time — new submissions resolve to it, while
 * in-flight instances keep referencing whichever version they already
 * pinned. Refuses to publish an empty graph — a structural invariant of
 * "a workflow", not a business rule.
 */
export async function publishWorkflowVersionForAuthoring(
  versionId: string,
  publishedBy: string
): Promise<ApprovalWorkflowVersion> {
  const version = await findWorkflowVersionById(versionId)
  if (!version) throw new Error("Workflow version not found.")
  if (version.status !== "DRAFT") throw new Error("Only a draft version can be published.")

  const steps = await findStepDefinitionsByVersion(versionId)
  if (steps.length === 0) throw new Error("Cannot publish a workflow version with no steps.")

  const previouslyPublished = await findPublishedWorkflowVersion(version.workflowDefinitionId)
  if (previouslyPublished) {
    await archiveWorkflowVersion(previouslyPublished.id)
  }

  const published = await publishWorkflowVersionRepo(versionId, publishedBy)

  await recordApprovalWorkflowAudit({
    entityType: ApprovalWorkflowAuditEntityType.WorkflowVersion,
    entityId: published.id,
    action: ApprovalWorkflowAuditAction.VersionPublished,
    actor: publishedBy,
  })

  return published
}

/**
 * "Editing a published workflow must never modify existing versions" —
 * this is the only sanctioned way to change a published graph: copy its
 * steps into a brand new DRAFT version (next version number) under the
 * SAME definition, leaving the source version's rows untouched forever.
 */
export async function cloneVersionAsNewDraft(
  sourceVersionId: string,
  createdBy: string
): Promise<WorkflowVersionDetail> {
  const sourceVersion = await findWorkflowVersionById(sourceVersionId)
  if (!sourceVersion) throw new Error("Workflow version not found.")
  const definition = await findWorkflowDefinitionById(sourceVersion.workflowDefinitionId)
  if (!definition) throw new Error("Workflow definition not found.")

  const sourceSteps = await findStepDefinitionsByVersion(sourceVersionId)
  const latest = await findLatestWorkflowVersion(definition.id)
  const nextVersionNumber = (latest?.version ?? 0) + 1

  const newVersion = await createWorkflowVersion({
    workflowDefinitionId: definition.id,
    version: nextVersionNumber,
    defaultSlaHours: sourceVersion.defaultSlaHours,
    createdBy,
  })

  const newSteps = await replaceStepDefinitionsForVersion(
    newVersion.id,
    sourceSteps.map(toStepDefinitionInput)
  )

  await recordApprovalWorkflowAudit({
    entityType: ApprovalWorkflowAuditEntityType.WorkflowVersion,
    entityId: newVersion.id,
    action: ApprovalWorkflowAuditAction.VersionCloned,
    actor: createdBy,
    oldValue: sourceVersionId,
    newValue: newVersion.id,
  })

  return { definition, version: newVersion, steps: newSteps }
}

/**
 * Full "workflow cloning" — a new, independent ApprovalWorkflowDefinition
 * (own id/code), seeded from an existing definition's latest version.
 * Works on any definition, template-flagged or not: isTemplate only
 * affects a later phase's auto-matching, never what can be cloned from.
 */
export async function cloneWorkflowDefinitionAsTemplate(
  sourceDefinitionId: string,
  newCode: string,
  newName: string,
  createdBy: string
): Promise<WorkflowVersionDetail> {
  const sourceDefinition = await findWorkflowDefinitionById(sourceDefinitionId)
  if (!sourceDefinition) throw new Error("Workflow definition not found.")

  const sourceLatestVersion = await findLatestWorkflowVersion(sourceDefinitionId)
  const sourceSteps = sourceLatestVersion ? await findStepDefinitionsByVersion(sourceLatestVersion.id) : []

  const newDefinition = await createWorkflowDefinition({
    code: newCode,
    name: newName,
    description: sourceDefinition.description,
    entityType: sourceDefinition.entityType,
    companyId: sourceDefinition.companyId,
    branchId: sourceDefinition.branchId,
    departmentId: sourceDefinition.departmentId,
    conditionExpression: asJsonInput(sourceDefinition.conditionExpression),
    priority: sourceDefinition.priority,
    isTemplate: false,
    createdBy,
  })

  const newVersion = await createWorkflowVersion({
    workflowDefinitionId: newDefinition.id,
    version: 1,
    defaultSlaHours: sourceLatestVersion?.defaultSlaHours ?? null,
    createdBy,
  })

  const newSteps = await replaceStepDefinitionsForVersion(newVersion.id, sourceSteps.map(toStepDefinitionInput))

  await recordApprovalWorkflowAudit({
    entityType: ApprovalWorkflowAuditEntityType.WorkflowDefinition,
    entityId: newDefinition.id,
    action: ApprovalWorkflowAuditAction.DefinitionCloned,
    actor: createdBy,
    oldValue: sourceDefinitionId,
    newValue: newDefinition.id,
  })

  return { definition: newDefinition, version: newVersion, steps: newSteps }
}

export async function archiveWorkflowDefinitionForAuthoring(
  id: string,
  actor: string
): Promise<ApprovalWorkflowDefinition> {
  const definition = await archiveWorkflowDefinitionRepo(id)
  await recordApprovalWorkflowAudit({
    entityType: ApprovalWorkflowAuditEntityType.WorkflowDefinition,
    entityId: definition.id,
    action: ApprovalWorkflowAuditAction.DefinitionArchived,
    actor,
  })
  return definition
}

export async function restoreWorkflowDefinitionForAuthoring(
  id: string,
  actor: string
): Promise<ApprovalWorkflowDefinition> {
  const definition = await restoreWorkflowDefinitionRepo(id)
  await recordApprovalWorkflowAudit({
    entityType: ApprovalWorkflowAuditEntityType.WorkflowDefinition,
    entityId: definition.id,
    action: ApprovalWorkflowAuditAction.DefinitionRestored,
    actor,
  })
  return definition
}

/** Prisma's read-side JsonValue and write-side InputJsonValue are
 * structurally the same data (string/number/boolean/null/array/object) —
 * this cast only exists because Prisma types the two directions
 * separately. Never encounters the JsonNull/DbNull sentinel objects, since
 * those only appear in query filters, never in values read back from the
 * database. */
function asJsonInput(value: Prisma.JsonValue | null): Prisma.InputJsonValue | null {
  return value as Prisma.InputJsonValue | null
}

function toStepDefinitionInput(step: ApprovalStepDefinition): ApprovalStepDefinitionInput {
  return {
    workflowVersionId: step.workflowVersionId,
    stepOrder: step.stepOrder,
    branchKey: step.branchKey,
    name: step.name,
    approverResolutionType: step.approverResolutionType,
    approverResolutionConfig: asJsonInput(step.approverResolutionConfig),
    quorumMode: step.quorumMode,
    conditionExpression: asJsonInput(step.conditionExpression),
    skipIfNoApproverResolved: step.skipIfNoApproverResolved,
    isOptional: step.isOptional,
    slaHours: step.slaHours,
    uiMetadata: asJsonInput(step.uiMetadata),
  }
}
