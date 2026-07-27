"use server"

import { revalidatePath } from "next/cache"

import { employeeDirectory, addEmployeeProfile, isFinTaken } from "@/data/employee-directory"
import {
  deleteImportDraft,
  getImportDraft,
  listImportDrafts,
  saveImportDraft,
} from "@/data/import-draft-store"
import { isEmployeeNumberTaken } from "@/lib/employees"
import { getWizardMasterData } from "@/lib/wizard-master-data"
import { importRows } from "@/lib/employee-import/import-service"
import type { ImportDraft, ImportRow, ImportRowResult } from "@/lib/employee-import/types"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"

export async function getImportMasterDataAction(): Promise<WizardMasterData> {
  return getWizardMasterData()
}

/**
 * A snapshot the Validate step's Web Worker needs before it can check
 * uniqueness — fetched once per validation run, not per row.
 */
export async function getExistingEmployeeKeysAction(): Promise<{
  fins: string[]
  employeeNumbers: string[]
}> {
  return {
    fins: employeeDirectory.map((employee) => employee.personal.finCode),
    employeeNumbers: employeeDirectory.map((employee) => employee.employment.employeeNumber),
  }
}

export async function listImportDraftsAction(): Promise<ImportDraft[]> {
  return listImportDrafts()
}

export async function getImportDraftAction(id: string): Promise<ImportDraft | null> {
  return getImportDraft(id) ?? null
}

export async function saveImportDraftAction(draft: ImportDraft): Promise<{ success: boolean }> {
  saveImportDraft(draft)
  revalidatePath("/[locale]/employees/import", "page")
  return { success: true }
}

export async function deleteImportDraftAction(id: string): Promise<{ success: boolean }> {
  deleteImportDraft(id)
  revalidatePath("/[locale]/employees/import", "page")
  return { success: true }
}

/**
 * Thin Server Action wrapper around the framework-agnostic import-service —
 * all it does is supply the live data-layer functions and re-validate
 * against the CURRENT directory (not the Preview-time snapshot), then
 * revalidate the pages that show employee data. The actual business logic
 * lives in importRows, isolated from Next.js entirely (requirement: ready
 * to move to a background queue later without a redesign).
 */
export async function runImportChunkAction(rows: ImportRow[]): Promise<{ results: ImportRowResult[] }> {
  const masterData = await getWizardMasterData()

  const results = importRows(rows, masterData, {
    isFinTaken,
    isEmployeeNumberTaken: (employeeNumber) =>
      isEmployeeNumberTaken(
        employeeNumber,
        employeeDirectory.map((employee) => employee.employment.employeeNumber)
      ),
    addEmployeeProfile,
  })

  revalidatePath("/[locale]/employees", "page")
  revalidatePath("/[locale]/employees/[id]", "page")

  return { results }
}
