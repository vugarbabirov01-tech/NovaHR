"use server"

import { revalidatePath } from "next/cache"

import {
  archiveWorkSchedule as archiveWorkScheduleRepo,
  createWorkSchedule as createWorkScheduleRepo,
  restoreWorkSchedule as restoreWorkScheduleRepo,
  updateWorkSchedule as updateWorkScheduleRepo,
  type WorkSchedule,
} from "@/repositories/work-schedule-repository"
import { workScheduleInputSchema, idSchema } from "@/lib/validation/master-data"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"

function revalidateWorkSchedules() {
  // Best-effort cache invalidation — kept out of the write's try/catch so a
  // revalidation hiccup can never get reported back as a failed write.
  try {
    revalidatePath("/[locale]/work-schedules", "page")
    revalidatePath("/[locale]/employees/new", "page")
  } catch {
    // Ignored — the write already succeeded regardless of revalidation.
  }
}

export async function createWorkScheduleAction(input: unknown): Promise<MasterDataActionResult<WorkSchedule>> {
  const parsed = workScheduleInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  let schedule: WorkSchedule
  try {
    schedule = await createWorkScheduleRepo(parsed.data)
  } catch {
    return { success: false, error: "Could not create work schedule." }
  }
  revalidateWorkSchedules()
  return { success: true, data: schedule }
}

export async function updateWorkScheduleAction(
  id: string,
  input: unknown
): Promise<MasterDataActionResult<WorkSchedule>> {
  const parsedId = idSchema.safeParse(id)
  const parsed = workScheduleInputSchema.safeParse(input)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  let schedule: WorkSchedule
  try {
    schedule = await updateWorkScheduleRepo(parsedId.data, parsed.data)
  } catch {
    return { success: false, error: "Could not update work schedule." }
  }
  revalidateWorkSchedules()
  return { success: true, data: schedule }
}

export async function archiveWorkScheduleAction(id: string): Promise<MasterDataActionResult<WorkSchedule>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let schedule: WorkSchedule
  try {
    schedule = await archiveWorkScheduleRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not archive work schedule." }
  }
  revalidateWorkSchedules()
  return { success: true, data: schedule }
}

export async function restoreWorkScheduleAction(id: string): Promise<MasterDataActionResult<WorkSchedule>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let schedule: WorkSchedule
  try {
    schedule = await restoreWorkScheduleRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not restore work schedule." }
  }
  revalidateWorkSchedules()
  return { success: true, data: schedule }
}
