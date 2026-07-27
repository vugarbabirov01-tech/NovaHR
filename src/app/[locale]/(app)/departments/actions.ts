"use server"

import { revalidatePath } from "next/cache"

import {
  archiveDepartment as archiveDepartmentRepo,
  createDepartment as createDepartmentRepo,
  restoreDepartment as restoreDepartmentRepo,
  updateDepartment as updateDepartmentRepo,
  type Department,
} from "@/repositories/department-repository"
import { departmentInputSchema, idSchema } from "@/lib/validation/master-data"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"

function revalidateDepartments() {
  // Best-effort cache invalidation — must never run inside the same
  // try/catch as the write, or a revalidation hiccup would get reported
  // back to the client as "the write failed" even though it succeeded.
  try {
    revalidatePath("/[locale]/departments", "page")
    revalidatePath("/[locale]/positions", "page")
    revalidatePath("/[locale]/employees/new", "page")
  } catch {
    // Ignored — the write already succeeded regardless of revalidation.
  }
}

export async function createDepartmentAction(input: unknown): Promise<MasterDataActionResult<Department>> {
  const parsed = departmentInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  let department: Department
  try {
    department = await createDepartmentRepo(parsed.data)
  } catch {
    return { success: false, error: "Could not create department." }
  }
  revalidateDepartments()
  return { success: true, data: department }
}

export async function updateDepartmentAction(
  id: string,
  input: unknown
): Promise<MasterDataActionResult<Department>> {
  const parsedId = idSchema.safeParse(id)
  const parsed = departmentInputSchema.safeParse(input)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  let department: Department
  try {
    department = await updateDepartmentRepo(parsedId.data, parsed.data)
  } catch {
    return { success: false, error: "Could not update department." }
  }
  revalidateDepartments()
  return { success: true, data: department }
}

export async function archiveDepartmentAction(id: string): Promise<MasterDataActionResult<Department>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let department: Department
  try {
    department = await archiveDepartmentRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not archive department." }
  }
  revalidateDepartments()
  return { success: true, data: department }
}

export async function restoreDepartmentAction(id: string): Promise<MasterDataActionResult<Department>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let department: Department
  try {
    department = await restoreDepartmentRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not restore department." }
  }
  revalidateDepartments()
  return { success: true, data: department }
}
