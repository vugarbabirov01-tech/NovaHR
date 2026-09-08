"use server"

import { revalidatePath } from "next/cache"

import {
  archivePosition as archivePositionRepo,
  createPosition as createPositionRepo,
  deletePosition as deletePositionRepo,
  findPositionById,
  restorePosition as restorePositionRepo,
  updatePosition as updatePositionRepo,
  type Position,
} from "@/repositories/position-repository"
import { findAllEmployees } from "@/repositories/employee-repository"
import { positionInputSchema, idSchema } from "@/lib/validation/master-data"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"

function revalidatePositions() {
  // Best-effort cache invalidation — kept out of the write's try/catch so a
  // revalidation hiccup can never get reported back as a failed write.
  try {
    revalidatePath("/[locale]/positions", "page")
    revalidatePath("/[locale]/employees/new", "page")
  } catch {
    // Ignored — the write already succeeded regardless of revalidation.
  }
}

export async function createPositionAction(input: unknown): Promise<MasterDataActionResult<Position>> {
  const parsed = positionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  let position: Position
  try {
    position = await createPositionRepo(parsed.data)
  } catch {
    return { success: false, error: "Could not create position." }
  }
  revalidatePositions()
  return { success: true, data: position }
}

export async function updatePositionAction(id: string, input: unknown): Promise<MasterDataActionResult<Position>> {
  const parsedId = idSchema.safeParse(id)
  const parsed = positionInputSchema.safeParse(input)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  let position: Position
  try {
    position = await updatePositionRepo(parsedId.data, parsed.data)
  } catch {
    return { success: false, error: "Could not update position." }
  }
  revalidatePositions()
  return { success: true, data: position }
}

export async function archivePositionAction(id: string): Promise<MasterDataActionResult<Position>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let position: Position
  try {
    position = await archivePositionRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not archive position." }
  }
  revalidatePositions()
  return { success: true, data: position }
}

export async function restorePositionAction(id: string): Promise<MasterDataActionResult<Position>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let position: Position
  try {
    position = await restorePositionRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not restore position." }
  }
  revalidatePositions()
  return { success: true, data: position }
}

export interface DeletePositionResult {
  success: boolean
  /** "in-use" means the block is real referential integrity, not a transient failure — the client shows employeeCount instead of a generic error. */
  error?: "not-found" | "in-use" | "unknown"
  employeeCount?: number
}

/**
 * Permanent delete — archive/restore never destroys data, this does.
 * Employee only stores the position's plain title (no live FK — see
 * employee-repository.ts), so the reference check has to happen here, in
 * application code, or a delete would silently strand real employee
 * records pointing at a position that no longer exists.
 */
export async function deletePositionAction(id: string): Promise<DeletePositionResult> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "not-found" }

  const position = await findPositionById(parsedId.data)
  if (!position) return { success: false, error: "not-found" }

  const employees = await findAllEmployees()
  const employeeCount = employees.filter((employee) => employee.employment.position === position.title).length

  if (employeeCount > 0) {
    return { success: false, error: "in-use", employeeCount }
  }

  try {
    await deletePositionRepo(parsedId.data)
  } catch {
    return { success: false, error: "unknown" }
  }
  revalidatePositions()
  return { success: true }
}
