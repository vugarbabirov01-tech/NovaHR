"use server"

import { revalidatePath } from "next/cache"

import {
  archiveDepartment as archiveDepartmentRepo,
  countPositionsInDepartment,
  createDepartment as createDepartmentRepo,
  deleteDepartment as deleteDepartmentRepo,
  findDepartmentById,
  restoreDepartment as restoreDepartmentRepo,
  updateDepartment as updateDepartmentRepo,
  type Department,
} from "@/repositories/department-repository"
import { findAllEmployees } from "@/repositories/employee-repository"
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

export interface DeleteDepartmentResult {
  success: boolean
  /** "in-use" means the block is real referential integrity, not a transient failure — the client shows employeeCount/positionCount instead of a generic error. */
  error?: "not-found" | "in-use" | "unknown"
  employeeCount?: number
  positionCount?: number
}

/**
 * Permanent delete — archive/restore never destroys data, this does.
 * Blocks (rather than cascading or orphaning) when anything still points at
 * this department: Position.departmentId is a required FK, so Prisma would
 * reject the delete anyway once a single position remains, but Employee
 * only stores the department's plain name (no live FK — see employee-
 * repository.ts), so that half of the check has to happen here, in
 * application code, or a delete would silently strand real employee
 * records pointing at a department that no longer exists.
 */
export async function deleteDepartmentAction(id: string): Promise<DeleteDepartmentResult> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "not-found" }

  const department = await findDepartmentById(parsedId.data)
  if (!department) return { success: false, error: "not-found" }

  const [positionCount, employees] = await Promise.all([
    countPositionsInDepartment(parsedId.data),
    findAllEmployees(),
  ])
  const employeeCount = employees.filter((employee) => employee.employment.department === department.name).length

  if (positionCount > 0 || employeeCount > 0) {
    return { success: false, error: "in-use", employeeCount, positionCount }
  }

  try {
    await deleteDepartmentRepo(parsedId.data)
  } catch {
    return { success: false, error: "unknown" }
  }
  revalidateDepartments()
  return { success: true }
}
