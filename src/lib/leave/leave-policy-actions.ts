"use server"

import { revalidatePath } from "next/cache"

import {
  archiveLeavePolicy as archiveLeavePolicyRepo,
  createLeavePolicy as createLeavePolicyRepo,
  restoreLeavePolicy as restoreLeavePolicyRepo,
  updateLeavePolicy as updateLeavePolicyRepo,
  type LeavePolicy,
  type LeavePolicyInput as LeavePolicyRepoInput,
} from "@/repositories/leave-policy-repository"
import { leavePolicyInputSchema, idSchema } from "@/lib/validation/leave"
import { LeaveAuditAction, LeaveAuditEntityType, recordLeaveAudit } from "@/lib/leave/leave-audit"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"

function revalidateLeavePolicies() {
  try {
    revalidatePath("/[locale]/leave", "page")
  } catch {
    // Ignored — the write already succeeded regardless of revalidation.
  }
}

// zod validates dates as ISO strings (the shape a client/form submits);
// the repository takes real Date objects. This is the one place that
// converts between them, so neither the schema nor the repository has to.
function toRepoInput(parsed: ReturnType<typeof leavePolicyInputSchema.parse>): LeavePolicyRepoInput {
  return {
    ...parsed,
    effectiveFrom: new Date(parsed.effectiveFrom),
    effectiveTo: parsed.effectiveTo ? new Date(parsed.effectiveTo) : null,
  }
}

export async function createLeavePolicyAction(input: unknown): Promise<MasterDataActionResult<LeavePolicy>> {
  const parsed = leavePolicyInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  let policy: LeavePolicy
  try {
    policy = await createLeavePolicyRepo(toRepoInput(parsed.data))
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.LeavePolicy,
      entityId: policy.id,
      action: LeaveAuditAction.LeavePolicyCreated,
      actor: "System",
    })
  } catch {
    return { success: false, error: "Could not create leave policy." }
  }
  revalidateLeavePolicies()
  return { success: true, data: policy }
}

export async function updateLeavePolicyAction(
  id: string,
  input: unknown
): Promise<MasterDataActionResult<LeavePolicy>> {
  const parsedId = idSchema.safeParse(id)
  const parsed = leavePolicyInputSchema.safeParse(input)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  let policy: LeavePolicy
  try {
    policy = await updateLeavePolicyRepo(parsedId.data, toRepoInput(parsed.data))
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.LeavePolicy,
      entityId: policy.id,
      action: LeaveAuditAction.LeavePolicyUpdated,
      actor: "System",
    })
  } catch {
    return { success: false, error: "Could not update leave policy." }
  }
  revalidateLeavePolicies()
  return { success: true, data: policy }
}

export async function archiveLeavePolicyAction(id: string): Promise<MasterDataActionResult<LeavePolicy>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let policy: LeavePolicy
  try {
    policy = await archiveLeavePolicyRepo(parsedId.data)
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.LeavePolicy,
      entityId: policy.id,
      action: LeaveAuditAction.LeavePolicyArchived,
      actor: "System",
    })
  } catch {
    return { success: false, error: "Could not archive leave policy." }
  }
  revalidateLeavePolicies()
  return { success: true, data: policy }
}

export async function restoreLeavePolicyAction(id: string): Promise<MasterDataActionResult<LeavePolicy>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let policy: LeavePolicy
  try {
    policy = await restoreLeavePolicyRepo(parsedId.data)
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.LeavePolicy,
      entityId: policy.id,
      action: LeaveAuditAction.LeavePolicyRestored,
      actor: "System",
    })
  } catch {
    return { success: false, error: "Could not restore leave policy." }
  }
  revalidateLeavePolicies()
  return { success: true, data: policy }
}
