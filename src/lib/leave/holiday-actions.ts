"use server"

import { revalidatePath } from "next/cache"

import {
  archiveHoliday as archiveHolidayRepo,
  createHoliday as createHolidayRepo,
  restoreHoliday as restoreHolidayRepo,
  updateHoliday as updateHolidayRepo,
  type Holiday,
  type HolidayInput as HolidayRepoInput,
} from "@/repositories/holiday-repository"
import { holidayInputSchema, idSchema } from "@/lib/validation/leave"
import { LeaveAuditAction, LeaveAuditEntityType, recordLeaveAudit } from "@/lib/leave/leave-audit"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"

function revalidateHolidays() {
  try {
    revalidatePath("/[locale]/leave", "page")
  } catch {
    // Ignored — the write already succeeded regardless of revalidation.
  }
}

function toRepoInput(parsed: ReturnType<typeof holidayInputSchema.parse>): HolidayRepoInput {
  return { ...parsed, date: new Date(parsed.date) }
}

export async function createHolidayAction(input: unknown): Promise<MasterDataActionResult<Holiday>> {
  const parsed = holidayInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  let holiday: Holiday
  try {
    holiday = await createHolidayRepo(toRepoInput(parsed.data))
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.Holiday,
      entityId: holiday.id,
      action: LeaveAuditAction.HolidayCreated,
      actor: "System",
    })
  } catch {
    return { success: false, error: "Could not create holiday." }
  }
  revalidateHolidays()
  return { success: true, data: holiday }
}

export async function updateHolidayAction(
  id: string,
  input: unknown
): Promise<MasterDataActionResult<Holiday>> {
  const parsedId = idSchema.safeParse(id)
  const parsed = holidayInputSchema.safeParse(input)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  let holiday: Holiday
  try {
    holiday = await updateHolidayRepo(parsedId.data, toRepoInput(parsed.data))
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.Holiday,
      entityId: holiday.id,
      action: LeaveAuditAction.HolidayUpdated,
      actor: "System",
    })
  } catch {
    return { success: false, error: "Could not update holiday." }
  }
  revalidateHolidays()
  return { success: true, data: holiday }
}

export async function archiveHolidayAction(id: string): Promise<MasterDataActionResult<Holiday>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let holiday: Holiday
  try {
    holiday = await archiveHolidayRepo(parsedId.data)
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.Holiday,
      entityId: holiday.id,
      action: LeaveAuditAction.HolidayArchived,
      actor: "System",
    })
  } catch {
    return { success: false, error: "Could not archive holiday." }
  }
  revalidateHolidays()
  return { success: true, data: holiday }
}

export async function restoreHolidayAction(id: string): Promise<MasterDataActionResult<Holiday>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let holiday: Holiday
  try {
    holiday = await restoreHolidayRepo(parsedId.data)
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.Holiday,
      entityId: holiday.id,
      action: LeaveAuditAction.HolidayRestored,
      actor: "System",
    })
  } catch {
    return { success: false, error: "Could not restore holiday." }
  }
  revalidateHolidays()
  return { success: true, data: holiday }
}
