"use server"

import type { Prisma } from "@/generated/prisma/client"
import {
  submitForApproval,
  recordApprovalDecision,
  cancelApprovalInstance,
  reopenApprovalInstance,
  markApprovalViewed,
  getApprovalInstanceDetail,
  getApprovalHistory,
  getApprovalActionsForInstance,
  getPendingApprovalsForEmployee,
  type ApprovalInstance,
  type ApprovalStepApprover,
  type ApprovalAction,
  type ApprovalInstanceDetail,
} from "@/lib/approval/approval-engine-service"
import {
  submitForApprovalInputSchema,
  approvalDecisionInputSchema,
  approvalInstanceActionInputSchema,
  idSchema,
} from "@/lib/validation/approval"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"

/**
 * The ONLY door a future business module (Leave, Expense, Overtime, Asset,
 * Recruitment, ...) uses to reach the Approval Engine — see the Phase 4C
 * self-review's point 8. A caller never imports approval-engine-service.ts,
 * a repository, or the state machine directly; it validates nothing itself
 * and trusts these actions to do so. Thin wrappers only: validate,
 * delegate, translate exceptions into the same {success,data?,error?}
 * shape every other Server Action in this codebase returns.
 */

export async function submitForApprovalAction(input: unknown): Promise<MasterDataActionResult<ApprovalInstance>> {
  const parsed = submitForApprovalInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const data = await submitForApproval({
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      // contextPayload is a required (non-nullable) Json column — zod's
      // recursive JsonValue type still technically allows a bare top-level
      // null (as any nested value could), which Prisma.InputJsonValue
      // doesn't accept directly; the schema's own non-null column
      // constraint is the real guarantee here.
      contextPayload: parsed.data.contextPayload as Prisma.InputJsonValue,
      submittedBy: parsed.data.submittedBy,
      scope: {
        companyId: parsed.data.companyId,
        branchId: parsed.data.branchId,
        departmentId: parsed.data.departmentId,
      },
    })
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not submit for approval." }
  }
}

async function decideAction(
  input: unknown,
  decision: "APPROVED" | "REJECTED" | "RETURNED"
): Promise<MasterDataActionResult<ApprovalStepApprover>> {
  const parsed = approvalDecisionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const data = await recordApprovalDecision({
      stepApproverId: parsed.data.stepApproverId,
      actorEmployeeId: parsed.data.actorEmployeeId,
      decision,
      comment: parsed.data.comment,
    })
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not record decision." }
  }
}

export function approveStepAction(input: unknown): Promise<MasterDataActionResult<ApprovalStepApprover>> {
  return decideAction(input, "APPROVED")
}

export function rejectStepAction(input: unknown): Promise<MasterDataActionResult<ApprovalStepApprover>> {
  return decideAction(input, "REJECTED")
}

export function returnStepAction(input: unknown): Promise<MasterDataActionResult<ApprovalStepApprover>> {
  return decideAction(input, "RETURNED")
}

export async function cancelApprovalInstanceAction(input: unknown): Promise<MasterDataActionResult<ApprovalInstance>> {
  const parsed = approvalInstanceActionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const data = await cancelApprovalInstance(parsed.data.instanceId, parsed.data.actorEmployeeId, parsed.data.comment)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not cancel approval." }
  }
}

export async function reopenApprovalInstanceAction(input: unknown): Promise<MasterDataActionResult<ApprovalInstance>> {
  const parsed = approvalInstanceActionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const data = await reopenApprovalInstance(parsed.data.instanceId, parsed.data.actorEmployeeId, parsed.data.comment)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not reopen approval." }
  }
}

export async function markApprovalViewedAction(
  stepApproverId: string,
  actorEmployeeId: string
): Promise<MasterDataActionResult<null>> {
  const parsedId = idSchema.safeParse(stepApproverId)
  const parsedActor = idSchema.safeParse(actorEmployeeId)
  if (!parsedId.success || !parsedActor.success) {
    return { success: false, error: "Invalid input." }
  }
  try {
    await markApprovalViewed(parsedId.data, parsedActor.data)
    return { success: true, data: null }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not mark viewed." }
  }
}

export async function getApprovalInstanceDetailAction(
  instanceId: string
): Promise<MasterDataActionResult<ApprovalInstanceDetail>> {
  const parsedId = idSchema.safeParse(instanceId)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  try {
    const data = await getApprovalInstanceDetail(parsedId.data)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Approval instance not found." }
  }
}

export async function getApprovalHistoryAction(
  entityType: string,
  entityId: string
): Promise<MasterDataActionResult<ApprovalInstance[]>> {
  try {
    const data = await getApprovalHistory(entityType, entityId)
    return { success: true, data }
  } catch {
    return { success: false, error: "Could not load approval history." }
  }
}

export async function getApprovalActionsForInstanceAction(
  instanceId: string
): Promise<MasterDataActionResult<ApprovalAction[]>> {
  const parsedId = idSchema.safeParse(instanceId)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  try {
    const data = await getApprovalActionsForInstance(parsedId.data)
    return { success: true, data }
  } catch {
    return { success: false, error: "Could not load approval actions." }
  }
}

export async function getPendingApprovalsForEmployeeAction(
  approverEmployeeId: string
): Promise<MasterDataActionResult<ApprovalStepApprover[]>> {
  const parsedId = idSchema.safeParse(approverEmployeeId)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  try {
    const data = await getPendingApprovalsForEmployee(parsedId.data)
    return { success: true, data }
  } catch {
    return { success: false, error: "Could not load pending approvals." }
  }
}
