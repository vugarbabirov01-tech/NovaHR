"use server"

import {
  addDisciplinaryAction,
  deleteDisciplinaryAction,
  DisciplineError,
  updateDisciplinaryAction,
} from "@/lib/discipline/discipline-service"
import type { DisciplineInput } from "@/lib/discipline/discipline-rules"

export type DisciplineActionResult = { success: true } | { success: false; code: string }

async function run(fn: () => Promise<void>): Promise<DisciplineActionResult> {
  try {
    await fn()
    return { success: true }
  } catch (error) {
    if (error instanceof DisciplineError) return { success: false, code: error.code }
    console.error("[discipline]", error)
    return { success: false, code: "unknown" }
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
