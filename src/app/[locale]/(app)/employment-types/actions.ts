"use server"

import { revalidatePath } from "next/cache"

import {
  archiveEmploymentType as archiveEmploymentTypeRepo,
  createEmploymentType as createEmploymentTypeRepo,
  restoreEmploymentType as restoreEmploymentTypeRepo,
  updateEmploymentType as updateEmploymentTypeRepo,
  type EmploymentType,
} from "@/repositories/employment-type-repository"
import { employmentTypeInputSchema, idSchema } from "@/lib/validation/master-data"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"

function revalidateEmploymentTypes() {
  // Best-effort cache invalidation — kept out of the write's try/catch so a
  // revalidation hiccup can never get reported back as a failed write.
  try {
    revalidatePath("/[locale]/employment-types", "page")
    revalidatePath("/[locale]/employees/new", "page")
  } catch {
    // Ignored — the write already succeeded regardless of revalidation.
  }
}

export async function createEmploymentTypeAction(
  input: unknown
): Promise<MasterDataActionResult<EmploymentType>> {
  const parsed = employmentTypeInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  let employmentType: EmploymentType
  try {
    employmentType = await createEmploymentTypeRepo(parsed.data)
  } catch {
    return { success: false, error: "Could not create employment type." }
  }
  revalidateEmploymentTypes()
  return { success: true, data: employmentType }
}

export async function updateEmploymentTypeAction(
  id: string,
  input: unknown
): Promise<MasterDataActionResult<EmploymentType>> {
  const parsedId = idSchema.safeParse(id)
  const parsed = employmentTypeInputSchema.safeParse(input)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  let employmentType: EmploymentType
  try {
    employmentType = await updateEmploymentTypeRepo(parsedId.data, parsed.data)
  } catch {
    return { success: false, error: "Could not update employment type." }
  }
  revalidateEmploymentTypes()
  return { success: true, data: employmentType }
}

export async function archiveEmploymentTypeAction(id: string): Promise<MasterDataActionResult<EmploymentType>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let employmentType: EmploymentType
  try {
    employmentType = await archiveEmploymentTypeRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not archive employment type." }
  }
  revalidateEmploymentTypes()
  return { success: true, data: employmentType }
}

export async function restoreEmploymentTypeAction(id: string): Promise<MasterDataActionResult<EmploymentType>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let employmentType: EmploymentType
  try {
    employmentType = await restoreEmploymentTypeRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not restore employment type." }
  }
  revalidateEmploymentTypes()
  return { success: true, data: employmentType }
}
