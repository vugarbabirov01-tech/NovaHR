"use server"

import { revalidatePath } from "next/cache"

import {
  addDisciplinaryAction,
  deleteDisciplinaryAction,
  DisciplineError,
  findLeaveOnDate,
  updateDisciplinaryAction,
} from "@/lib/discipline/discipline-service"
import type { DisciplineInput } from "@/lib/discipline/discipline-rules"

export type DisciplineActionResult = { success: true } | { success: false; code: string }

async function run(fn: () => Promise<void>): Promise<DisciplineActionResult> {
  try {
    await fn()
    try {
      // The notice on the employee card, list and profile comes from these pages.
      revalidatePath("/[locale]/employees", "page")
      revalidatePath("/[locale]/employees/[id]", "page")
    } catch {
      // Cache invalidation must not turn a saved record into an error.
    }
    return { success: true }
  } catch (error) {
    if (error instanceof DisciplineError) return { success: false, code: error.code }
    console.error("[discipline]", error)
    return { success: false, code: "unknown" }
  }
}

/** Warning only, never blocks saving: the leave type if the employee was on approved leave that day. */
export async function checkDisciplineDateAction(employeeId: string, date: string): Promise<string | null> {
  try {
    return await findLeaveOnDate(employeeId, date)
  } catch (error) {
    console.error("[discipline]", error)
    return null
  }
}

export async function addDisciplinaryActionAction(employeeId: string, input: DisciplineInput) {
  return run(() => addDisciplinaryAction(employeeId, input))
}

export async function updateDisciplinaryActionAction(id: string, input: DisciplineInput) {
  return run(() => updateDisciplinaryAction(id, input))
}

export async function deleteDisciplinaryActionAction(id: string) {
  return run(() => deleteDisciplinaryAction(id))
}
