"use server"

import { revalidatePath } from "next/cache"

import { employeeDirectory, addEmployeeProfile, updateEmployeeProfile, isFinTaken, getEmployeeByFin } from "@/data/employee-directory"
import {
  deleteImportDraft,
  getImportDraft,
  listImportDrafts,
  saveImportDraft,
} from "@/data/import-draft-store"
import { isEmployeeNumberTaken } from "@/lib/employees"
import { getWizardMasterData } from "@/lib/wizard-master-data"
import { importRows } from "@/lib/employee-import/import-service"
import { mapRawRow } from "@/lib/employee-import/row-mapper"
import {
  applyReferenceDataAutoCreate,
  collectReferenceDataNeeds,
  type ReferenceDataCreationSummary,
} from "@/lib/employee-import/reference-data-auto-resolver"
import type {
  ColumnMapping,
  ImportDraft,
  ImportRow,
  ImportRowResult,
  ImportSettings,
  RawImportRow,
} from "@/lib/employee-import/types"
import type { ExistingEmployeeSummary } from "@/lib/employee-import/row-validator"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"

export async function getImportMasterDataAction(): Promise<WizardMasterData> {
  return getWizardMasterData()
}

/**
 * A snapshot the Validate step's Web Worker needs before it can check
 * uniqueness/idempotency — fetched once per validation run, not per row.
 * Keyed by normalized FIN so the worker can look up an existing employee's
 * current salary for the Existing-vs-Excel comparison (§13) without
 * shipping the whole live directory to the client.
 */
export async function getExistingEmployeeKeysAction(): Promise<{
  employeesByFin: Record<string, ExistingEmployeeSummary>
  employeeNumbers: string[]
}> {
  const employeesByFin: Record<string, ExistingEmployeeSummary> = {}
  for (const employee of employeeDirectory) {
    employeesByFin[employee.personal.finCode.trim().toUpperCase()] = {
      id: employee.id,
      baseSalary: employee.payroll.baseSalary,
    }
  }
  return {
    employeesByFin,
    employeeNumbers: employeeDirectory.map((employee) => employee.employment.employeeNumber),
  }
}

/**
 * §3/§6/§7/§8/§16's "Step 4 — Auto Resolve": runs once per import, after
 * Mapping and before Validate. Re-derives each row's plain-text
 * Department/Position/Company (row-mapper.ts, so the exact same
 * blank-cell fallback substitution Validate will see later) purely to
 * discover what's missing, creates all of it for real in one Prisma
 * transaction (reference-data-auto-resolver.ts), and hands back the
 * augmented master-data snapshot the Validate step's worker resolves every
 * row against next — so by the time validation runs, a DEPARTMENT/POSITION
 * /COMPANY "not found" is already the rare defensive case, not the normal
 * one.
 */
export async function autoResolveMasterDataAction(
  rawRows: RawImportRow[],
  columnMapping: ColumnMapping[]
): Promise<{ masterData: WizardMasterData; created: ReferenceDataCreationSummary }> {
  const masterData = await getWizardMasterData()

  const rowInputs = rawRows.map((row) => {
    const { mapped } = mapRawRow(row, columnMapping)
    return { company: mapped.company, department: mapped.department, position: mapped.position }
  })
  const needs = collectReferenceDataNeeds(rowInputs)

  return applyReferenceDataAutoCreate(needs, masterData)
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
 * supplies the live data-layer functions, re-validates against the CURRENT
 * directory (not the Preview-time snapshot), then revalidates the pages
 * that show employee data. The actual business logic lives in importRows,
 * isolated from Next.js entirely (requirement: ready to move to a
 * background queue later without a redesign).
 *
 * Hardening per §24: every master-data id a row carries (departmentId/
 * positionId/companyId/managerId) came from the client, which already
 * ran its own resolution — but nothing stops a stale/tampered
 * payload from naming an id that isn't real. Re-fetching master data here
 * and rejecting any row referencing an id absent from it costs one query
 * per chunk, not per row, and turns "trust the client's ids" into "verify
 * them," without weakening anything the client already computed correctly.
 */
export async function runImportChunkAction(
  rows: ImportRow[],
  settings: ImportSettings
): Promise<{ results: ImportRowResult[] }> {
  const masterData = await getWizardMasterData()
  const knownIds = {
    departments: new Set(masterData.departments.map((d) => d.id)),
    positions: new Set(masterData.positions.map((p) => p.id)),
    companies: new Set(masterData.companies.map((c) => c.id)),
    managers: new Set(masterData.managers.map((m) => m.id)),
  }

  function hasUnknownId(row: ImportRow): boolean {
    const m = row.mapped
    return Boolean(
      (m.departmentId && !knownIds.departments.has(m.departmentId)) ||
        (m.positionId && !knownIds.positions.has(m.positionId)) ||
        (m.companyId && !knownIds.companies.has(m.companyId)) ||
        (m.managerId && !knownIds.managers.has(m.managerId))
    )
  }

  const verifiedRows = rows.map((row) => (hasUnknownId(row) ? { ...row, severity: "error" as const, willImport: false } : row))

  const results = importRows(verifiedRows, masterData, settings, {
    isFinTaken,
    getEmployeeByFin,
    isEmployeeNumberTaken: (employeeNumber) =>
      isEmployeeNumberTaken(
        employeeNumber,
        employeeDirectory.map((employee) => employee.employment.employeeNumber)
      ),
    addEmployeeProfile,
    updateEmployeeProfile,
  })

  revalidatePath("/[locale]/employees", "page")
  revalidatePath("/[locale]/employees/[id]", "page")

  return { results }
}
