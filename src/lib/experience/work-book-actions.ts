"use server"

import { revalidatePath } from "next/cache"

import {
  applyWorkBookReview,
  validateWorkBookReview,
  type WorkBookErrorCode,
  type WorkBookReviewInput,
} from "@/lib/experience/work-book-review"
import { findEmployeeById, updateEmployee } from "@/repositories/employee-repository"
import type { WorkExperienceDuration } from "@/types/employee-profile"

export type WorkBookActionResult =
  | {
      success: true
      leaveDaysBefore: number
      leaveDaysAfter: number
      effective: WorkExperienceDuration
      overlapEmasDays: number
      overlapCurrentDays: number
    }
  | { success: false; code: WorkBookErrorCode }

/** With `save: false` it only reports what the decision would change. */
async function run(employeeId: string, input: WorkBookReviewInput, save: boolean): Promise<WorkBookActionResult> {
  try {
    const now = new Date()
    const invalid = validateWorkBookReview(input, now.toISOString().slice(0, 10))
    // A preview does not need the reviewer or the grounds yet.
    if (invalid && (save || (invalid !== "reviewerRequired" && invalid !== "noteRequired"))) {
      return { success: false, code: invalid }
    }
    const existing = await findEmployeeById(employeeId)
    if (!existing) return { success: false, code: "notFound" }

    const outcome = applyWorkBookReview(existing, input, now)
    if (save) await updateEmployee(employeeId, outcome.profile)

    return {
      success: true,
      leaveDaysBefore: outcome.leaveDaysBefore,
      leaveDaysAfter: outcome.leaveDaysAfter,
      effective: outcome.effective,
      overlapEmasDays: outcome.overlapEmasDays,
      overlapCurrentDays: outcome.overlapCurrentDays,
    }
  } catch (error) {
    console.error("[work-book] could not apply review", error)
    return { success: false, code: "unknown" }
  }
}

export async function previewWorkBookReviewAction(employeeId: string, input: WorkBookReviewInput) {
  return run(employeeId, input, false)
}

export async function saveWorkBookReviewAction(employeeId: string, input: WorkBookReviewInput) {
  const result = await run(employeeId, input, true)
  if (result.success) {
    try {
      revalidatePath("/[locale]/employees/[id]", "page")
      revalidatePath("/[locale]/employees/experience-review", "page")
    } catch {
      // Cache invalidation must not turn a saved decision into an error.
    }
  }
  return result
}
