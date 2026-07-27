"use server"

import { revalidatePath } from "next/cache"

import {
  archiveGrade as archiveGradeRepo,
  createGrade as createGradeRepo,
  restoreGrade as restoreGradeRepo,
  updateGrade as updateGradeRepo,
  type Grade,
} from "@/repositories/grade-repository"
import { gradeInputSchema, idSchema } from "@/lib/validation/master-data"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"

function revalidateGrades() {
  // Best-effort cache invalidation — kept out of the write's try/catch so a
  // revalidation hiccup can never get reported back as a failed write.
  try {
    revalidatePath("/[locale]/grades", "page")
    revalidatePath("/[locale]/employees/new", "page")
  } catch {
    // Ignored — the write already succeeded regardless of revalidation.
  }
}

export async function createGradeAction(input: unknown): Promise<MasterDataActionResult<Grade>> {
  const parsed = gradeInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  let grade: Grade
  try {
    grade = await createGradeRepo(parsed.data)
  } catch {
    return { success: false, error: "Could not create grade." }
  }
  revalidateGrades()
  return { success: true, data: grade }
}

export async function updateGradeAction(id: string, input: unknown): Promise<MasterDataActionResult<Grade>> {
  const parsedId = idSchema.safeParse(id)
  const parsed = gradeInputSchema.safeParse(input)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  let grade: Grade
  try {
    grade = await updateGradeRepo(parsedId.data, parsed.data)
  } catch {
    return { success: false, error: "Could not update grade." }
  }
  revalidateGrades()
  return { success: true, data: grade }
}

export async function archiveGradeAction(id: string): Promise<MasterDataActionResult<Grade>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let grade: Grade
  try {
    grade = await archiveGradeRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not archive grade." }
  }
  revalidateGrades()
  return { success: true, data: grade }
}

export async function restoreGradeAction(id: string): Promise<MasterDataActionResult<Grade>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let grade: Grade
  try {
    grade = await restoreGradeRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not restore grade." }
  }
  revalidateGrades()
  return { success: true, data: grade }
}
