"use server"

import { revalidatePath } from "next/cache"

import {
  archivePosition as archivePositionRepo,
  createPosition as createPositionRepo,
  restorePosition as restorePositionRepo,
  updatePosition as updatePositionRepo,
  type Position,
} from "@/repositories/position-repository"
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
