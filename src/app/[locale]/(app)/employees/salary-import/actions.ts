"use server"

import { revalidatePath } from "next/cache"

import { findEmployeeByFin, updateEmployee } from "@/repositories/employee-repository"
import { applySalaryUpdate } from "@/lib/salary-import/apply-salary-update"
import type {
  SalaryImportCommitResult,
  SalaryImportPreviewResult,
  SalaryImportPreviewRow,
} from "@/lib/salary-import/types"

export interface SalaryImportInputRow {
  rowNumber: number
  finCode: string
  salary?: number
  effectiveDate?: string
  parseError?: string
}

function findDuplicateFins(rows: SalaryImportInputRow[]): Set<string> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.finCode) continue
    counts.set(row.finCode, (counts.get(row.finCode) ?? 0) + 1)
  }
  return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([fin]) => fin))
}

/**
 * Resolves every row against the real Employee directory — this is the one
 * place Salary Import needs the server at all, since matching by FIN means
 * looking a real record up (never trusting anything the client claims about
 * "existing salary"). Never writes anything; that only happens once the
 * user confirms via commitSalaryImportAction below.
 */
export async function previewSalaryImportAction(
  rows: SalaryImportInputRow[]
): Promise<SalaryImportPreviewResult> {
  const duplicateFins = findDuplicateFins(rows)
  const previewRows: SalaryImportPreviewRow[] = []

  for (const row of rows) {
    if (row.parseError) {
      previewRows.push({ rowNumber: row.rowNumber, finCode: row.finCode, status: "error", message: row.parseError })
      continue
    }

    if (duplicateFins.has(row.finCode)) {
      previewRows.push({
        rowNumber: row.rowNumber,
        finCode: row.finCode,
        newSalary: row.salary,
        effectiveDate: row.effectiveDate,
        status: "error",
        message: "FİN faylda təkrarlanır.",
      })
      continue
    }

    const employee = await findEmployeeByFin(row.finCode)
    if (!employee) {
      previewRows.push({
        rowNumber: row.rowNumber,
        finCode: row.finCode,
        newSalary: row.salary,
        effectiveDate: row.effectiveDate,
        status: "not-found",
        message: "FİN üzrə əməkdaş tapılmadı.",
      })
      continue
    }

    const currentSalary = employee.payroll.baseSalary > 0 ? employee.payroll.baseSalary : undefined
    const status =
      currentSalary === undefined ? "ready" : currentSalary === row.salary ? "no-change" : "will-update"

    previewRows.push({
      rowNumber: row.rowNumber,
      finCode: row.finCode,
      employeeName: `${employee.personal.firstName} ${employee.personal.lastName}`.trim(),
      employeeId: employee.id,
      currentSalary,
      newSalary: row.salary,
      effectiveDate: row.effectiveDate,
      status,
      message:
        status === "ready" ? "Hazırdır" : status === "will-update" ? "Dəyişəcək" : "Dəyişmir",
    })
  }

  const summary = {
    totalRows: previewRows.length,
    matched: previewRows.filter((r) => r.status === "ready" || r.status === "will-update" || r.status === "no-change")
      .length,
    notFound: previewRows.filter((r) => r.status === "not-found").length,
    errors: previewRows.filter((r) => r.status === "error").length,
  }

  return { rows: previewRows, summary }
}

function revalidateSalaryImport() {
  // Best-effort cache invalidation, kept out of the write loop's own error
  // handling below — the same isolation departments/actions.ts and the
  // employee bulk-delete action already use, so a revalidation hiccup can
  // never get reported back as a failed import.
  try {
    revalidatePath("/[locale]/employees", "page")
    revalidatePath("/[locale]/employees/[id]", "page")
    revalidatePath("/[locale]/dashboard", "page")
  } catch {
    // Ignored — every write already succeeded regardless of revalidation.
  }
}

/**
 * Writes only "ready"/"will-update" rows — re-resolves each FIN against the
 * live directory rather than trusting the Preview-time snapshot (the same
 * re-check discipline Employee Import's importRows already applies), so a
 * row that stopped matching between Preview and this confirm click is
 * reported as not-found here rather than silently skipped.
 */
export async function commitSalaryImportAction(rows: SalaryImportInputRow[]): Promise<SalaryImportCommitResult> {
  const duplicateFins = findDuplicateFins(rows)
  const failedRows: SalaryImportPreviewRow[] = []
  let updated = 0

  for (const row of rows) {
    if (row.parseError) {
      failedRows.push({ rowNumber: row.rowNumber, finCode: row.finCode, status: "error", message: row.parseError })
      continue
    }

    if (duplicateFins.has(row.finCode)) {
      failedRows.push({
        rowNumber: row.rowNumber,
        finCode: row.finCode,
        newSalary: row.salary,
        status: "error",
        message: "FİN faylda təkrarlanır.",
      })
      continue
    }

    const employee = await findEmployeeByFin(row.finCode)
    if (!employee) {
      failedRows.push({
        rowNumber: row.rowNumber,
        finCode: row.finCode,
        newSalary: row.salary,
        status: "not-found",
        message: "FİN üzrə əməkdaş tapılmadı.",
      })
      continue
    }

    if (row.salary === undefined) {
      failedRows.push({
        rowNumber: row.rowNumber,
        finCode: row.finCode,
        status: "error",
        message: "Maaş göstərilməyib.",
      })
      continue
    }

    // Already matches what's on file — nothing to write, and nothing worth
    // a redundant "changed from X to X" history entry. Still counts as a
    // success from HR's point of view: the system already reflects the
    // file's value.
    if (employee.payroll.baseSalary === row.salary) {
      updated += 1
      continue
    }

    const updatedProfile = applySalaryUpdate(employee, row.salary, row.effectiveDate)
    await updateEmployee(employee.id, updatedProfile)
    updated += 1
  }

  revalidateSalaryImport()

  return {
    summary: {
      updated,
      notFound: failedRows.filter((r) => r.status === "not-found").length,
      errors: failedRows.filter((r) => r.status === "error").length,
    },
    failedRows,
  }
}
