"use server"

import {
  createWorkflowDefinitionWithDraftVersion,
  getWorkflowVersionDetail,
  updateWorkflowDefinitionMetadata,
  replaceDraftSteps,
  createDraftStep,
  updateDraftStep,
  deleteDraftStep,
  updateWorkflowVersionCanvasMetadata,
  publishWorkflowVersionForAuthoring,
  cloneVersionAsNewDraft,
  cloneWorkflowDefinitionAsTemplate,
  archiveWorkflowDefinitionForAuthoring,
  restoreWorkflowDefinitionForAuthoring,
  type WorkflowDefinitionWithVersion,
  type WorkflowVersionDetail,
} from "@/lib/approval/approval-workflow-authoring-service"
import {
  findActiveWorkflowDefinitionsByEntityType,
  findAllWorkflowDefinitions,
  type ApprovalWorkflowDefinition,
} from "@/repositories/approval-workflow-definition-repository"
import type { ApprovalStepDefinition } from "@/repositories/approval-step-definition-repository"
import {
  approvalWorkflowDefinitionInputSchema,
  approvalWorkflowDefinitionUpdateSchema,
  approvalWorkflowDefinitionCloneSchema,
  approvalStepDefinitionInputSchema,
  approvalStepDefinitionListSchema,
  approvalWorkflowCanvasMetadataSchema,
  idSchema,
} from "@/lib/validation/approval"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"
import { z } from "zod"

/**
 * Thin "use server" wrappers over approval-workflow-authoring-service.ts —
 * validate, delegate, translate exceptions into the same
 * {success,data?,error?} shape every other Server Action in this codebase
 * returns (see leave-policy-actions.ts). No revalidatePath calls: no UI
 * route consumes this module yet, so there's nothing to revalidate —
 * added when a Workflow Builder screen exists to read it.
 */

const createDefinitionSchema = approvalWorkflowDefinitionInputSchema.extend({
  defaultSlaHours: z.number().int().positive().optional().nullable(),
})

export async function createWorkflowDefinitionAction(
  input: unknown
): Promise<MasterDataActionResult<WorkflowDefinitionWithVersion>> {
  const parsed = createDefinitionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const result = await createWorkflowDefinitionWithDraftVersion(parsed.data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not create workflow." }
  }
}

export async function listWorkflowDefinitionsAction(
  entityType?: string
): Promise<MasterDataActionResult<ApprovalWorkflowDefinition[]>> {
  try {
    const data = entityType
      ? await findActiveWorkflowDefinitionsByEntityType(entityType)
      : await findAllWorkflowDefinitions()
    return { success: true, data }
  } catch {
    return { success: false, error: "Could not list workflow definitions." }
  }
}

export async function updateWorkflowDefinitionMetadataAction(
  definitionId: string,
  input: unknown,
  actor: string
): Promise<MasterDataActionResult<ApprovalWorkflowDefinition>> {
  const parsedId = idSchema.safeParse(definitionId)
  const parsed = approvalWorkflowDefinitionUpdateSchema.safeParse(input)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const data = await updateWorkflowDefinitionMetadata(parsedId.data, parsed.data, actor)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not update workflow." }
  }
}

export async function getWorkflowVersionDetailAction(
  versionId: string
): Promise<MasterDataActionResult<WorkflowVersionDetail>> {
  const parsedId = idSchema.safeParse(versionId)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  try {
    const data = await getWorkflowVersionDetail(parsedId.data)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Workflow version not found." }
  }
}

export async function replaceDraftStepsAction(
  versionId: string,
  steps: unknown,
  actor: string
): Promise<MasterDataActionResult<ApprovalStepDefinition[]>> {
  const parsedId = idSchema.safeParse(versionId)
  const parsed = approvalStepDefinitionListSchema.safeParse(steps)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const stepsWithVersion = parsed.data.map((step) => ({ ...step, workflowVersionId: parsedId.data }))
    const data = await replaceDraftSteps(parsedId.data, stepsWithVersion, actor)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not save workflow steps." }
  }
}

export async function createDraftStepAction(
  versionId: string,
  step: unknown,
  actor: string
): Promise<MasterDataActionResult<ApprovalStepDefinition>> {
  const parsedId = idSchema.safeParse(versionId)
  const parsed = approvalStepDefinitionInputSchema.safeParse(step)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const data = await createDraftStep(parsedId.data, { ...parsed.data, workflowVersionId: parsedId.data }, actor)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not create step." }
  }
}

export async function updateDraftStepAction(
  stepId: string,
  versionId: string,
  step: unknown,
  actor: string
): Promise<MasterDataActionResult<ApprovalStepDefinition>> {
  const parsedStepId = idSchema.safeParse(stepId)
  const parsedVersionId = idSchema.safeParse(versionId)
  const parsed = approvalStepDefinitionInputSchema.safeParse(step)
  if (!parsedStepId.success || !parsedVersionId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const data = await updateDraftStep(parsedStepId.data, { ...parsed.data, workflowVersionId: parsedVersionId.data }, actor)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not update step." }
  }
}

export async function deleteDraftStepAction(
  stepId: string,
  versionId: string,
  actor: string
): Promise<MasterDataActionResult<null>> {
  const parsedStepId = idSchema.safeParse(stepId)
  const parsedVersionId = idSchema.safeParse(versionId)
  if (!parsedStepId.success || !parsedVersionId.success) {
    return { success: false, error: "Invalid id." }
  }
  try {
    await deleteDraftStep(parsedStepId.data, parsedVersionId.data, actor)
    return { success: true, data: null }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not delete step." }
  }
}

export async function updateWorkflowVersionCanvasMetadataAction(
  versionId: string,
  canvasMetadata: unknown
): Promise<MasterDataActionResult<null>> {
  const parsedId = idSchema.safeParse(versionId)
  const parsed = approvalWorkflowCanvasMetadataSchema.safeParse(canvasMetadata)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: "Invalid input." }
  }
  try {
    await updateWorkflowVersionCanvasMetadata(parsedId.data, parsed.data)
    return { success: true, data: null }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not save canvas layout." }
  }
}

export async function publishWorkflowVersionAction(
  versionId: string,
  publishedBy: string
): Promise<MasterDataActionResult<WorkflowVersionDetail["version"]>> {
  const parsedId = idSchema.safeParse(versionId)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  try {
    const data = await publishWorkflowVersionForAuthoring(parsedId.data, publishedBy)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not publish workflow." }
  }
}

export async function cloneVersionAsNewDraftAction(
  sourceVersionId: string,
  createdBy: string
): Promise<MasterDataActionResult<WorkflowVersionDetail>> {
  const parsedId = idSchema.safeParse(sourceVersionId)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  try {
    const data = await cloneVersionAsNewDraft(parsedId.data, createdBy)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not clone workflow version." }
  }
}

export async function cloneWorkflowDefinitionAsTemplateAction(
  sourceDefinitionId: string,
  input: unknown
): Promise<MasterDataActionResult<WorkflowVersionDetail>> {
  const parsedId = idSchema.safeParse(sourceDefinitionId)
  const parsed = approvalWorkflowDefinitionCloneSchema.safeParse(input)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const data = await cloneWorkflowDefinitionAsTemplate(
      parsedId.data,
      parsed.data.code,
      parsed.data.name,
      parsed.data.createdBy
    )
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not clone workflow." }
  }
}

export async function archiveWorkflowDefinitionAction(
  id: string,
  actor: string
): Promise<MasterDataActionResult<ApprovalWorkflowDefinition>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  try {
    const data = await archiveWorkflowDefinitionForAuthoring(parsedId.data, actor)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not archive workflow." }
  }
}

export async function restoreWorkflowDefinitionAction(
  id: string,
  actor: string
): Promise<MasterDataActionResult<ApprovalWorkflowDefinition>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  try {
    const data = await restoreWorkflowDefinitionForAuthoring(parsedId.data, actor)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not restore workflow." }
  }
}
