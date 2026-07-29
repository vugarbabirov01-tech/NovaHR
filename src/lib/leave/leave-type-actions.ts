"use server"

import { revalidatePath } from "next/cache"

import {
  archiveLeaveType as archiveLeaveTypeRepo,
  createLeaveType as createLeaveTypeRepo,
  restoreLeaveType as restoreLeaveTypeRepo,
  updateLeaveType as updateLeaveTypeRepo,
  type LeaveType,
} from "@/repositories/leave-type-repository"
import { leaveTypeInputSchema, idSchema } from "@/lib/validation/leave"
import { LeaveAuditAction, LeaveAuditEntityType, recordLeaveAudit } from "@/lib/leave/leave-audit"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"

function revalidateLeaveTypes() {
  // Best-effort cache invalidation — kept out of the write's try/catch so a
  // revalidation hiccup can never get reported back as a failed write.
  try {
    revalidatePath("/[locale]/leave", "page")
  } catch {
    // Ignored — the write already succeeded regardless of revalidation.
  }
}

export async function createLeaveTypeAction(input: unknown): Promise<MasterDataActionResult<LeaveType>> {
  const parsed = leaveTypeInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  let leaveType: LeaveType
  try {
    leaveType = await createLeaveTypeRepo(parsed.data)
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.LeaveType,
      entityId: leaveType.id,
      action: LeaveAuditAction.LeaveTypeCreated,
      actor: "System",
    })
  } catch {
    return { success: false, error: "Could not create leave type." }
  }
  revalidateLeaveTypes()
  return { success: true, data: leaveType }
}

export async function updateLeaveTypeAction(
  id: string,
  input: unknown
): Promise<MasterDataActionResult<LeaveType>> {
  const parsedId = idSchema.safeParse(id)
  const parsed = leaveTypeInputSchema.safeParse(input)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  let leaveType: LeaveType
  try {
    leaveType = await updateLeaveTypeRepo(parsedId.data, parsed.data)
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.LeaveType,
      entityId: leaveType.id,
      action: LeaveAuditAction.LeaveTypeUpdated,
      actor: "System",
    })
  } catch {
    return { success: false, error: "Could not update leave type." }
  }
  revalidateLeaveTypes()
  return { success: true, data: leaveType }
}

export async function archiveLeaveTypeAction(id: string): Promise<MasterDataActionResult<LeaveType>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let leaveType: LeaveType
  try {
    leaveType = await archiveLeaveTypeRepo(parsedId.data)
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.LeaveType,
      entityId: leaveType.id,
      action: LeaveAuditAction.LeaveTypeArchived,
      actor: "System",
    })
  } catch {
    return { success: false, error: "Could not archive leave type." }
  }
  revalidateLeaveTypes()
  return { success: true, data: leaveType }
}

export async function restoreLeaveTypeAction(id: string): Promise<MasterDataActionResult<LeaveType>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let leaveType: LeaveType
  try {
    leaveType = await restoreLeaveTypeRepo(parsedId.data)
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.LeaveType,
      entityId: leaveType.id,
      action: LeaveAuditAction.LeaveTypeRestored,
      actor: "System",
    })
  } catch {
    return { success: false, error: "Could not restore leave type." }
  }
  revalidateLeaveTypes()
  return { success: true, data: leaveType }
}
