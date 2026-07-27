import { validateWizardStep, type WizardValidationMessages } from "@/lib/employee-wizard-validation"
import { generateNextEmployeeNumber, isEmployeeNumberTaken } from "@/lib/employees"
import { defaultWizardData, type EmployeeWizardData } from "@/types/employee-wizard"
import { CUSTOM_WORK_SCHEDULE_ID, type WizardMasterData } from "@/lib/employee-wizard-mapper"
import { mapRawRow } from "@/lib/employee-import/row-mapper"
import {
  resolveBranch,
  resolveCompany,
  resolveDepartment,
  resolveManager,
  resolvePosition,
  resolveWorkSchedule,
} from "@/lib/employee-import/master-data-resolver"
import type { ImportRow, ImportRowMessage, ImportSeverity, RawImportRow } from "@/lib/employee-import/types"
import type { ColumnMapping } from "@/lib/employee-import/types"

const VALIDATION_MESSAGES: WizardValidationMessages = { required: "This field is required." }

const SEVERITY_RANK: Record<ImportSeverity, number> = { info: 0, warning: 1, error: 2 }

function highestSeverity(messages: ImportRowMessage[]): ImportSeverity {
  return messages.reduce<ImportSeverity>(
    (max, message) => (SEVERITY_RANK[message.severity] > SEVERITY_RANK[max] ? message.severity : max),
    "info"
  )
}

/**
 * Validates every row of an uploaded file in one pass. Reuses
 * validateWizardStep (Personal + Employment only — Payroll/Labour Law stay
 * untouched, see types.ts) and generateNextEmployeeNumber/
 * isEmployeeNumberTaken exactly as Employee Create/Edit do; nothing here
 * duplicates that logic. Import-specific checks (FIN/master-data
 * existence, idempotency) are the only new rules.
 */
export function validateImportRows(
  rawRows: RawImportRow[],
  columnMapping: ColumnMapping[],
  masterData: WizardMasterData,
  existingFins: ReadonlySet<string>,
  existingEmployeeNumbers: ReadonlySet<string>,
  onProgress?: (processed: number, total: number) => void
): ImportRow[] {
  const mappedRows = rawRows.map((row) => ({ row, ...mapRawRow(row, columnMapping) }))

  const finOccurrences = new Map<string, number>()
  for (const { mapped } of mappedRows) {
    if (!mapped.finCode) continue
    finOccurrences.set(mapped.finCode, (finOccurrences.get(mapped.finCode) ?? 0) + 1)
  }

  const employeeNumberPool = new Set(existingEmployeeNumbers)
  const seenEmployeeNumbersInFile = new Set<string>()
  const results: ImportRow[] = []

  mappedRows.forEach(({ row, mapped, messages: normalizationMessages }, index) => {
    const messages: ImportRowMessage[] = [...normalizationMessages]

    const department = mapped.department ? resolveDepartment(mapped.department, masterData) : undefined
    if (mapped.department && !department) {
      messages.push({
        code: "DEPARTMENT_NOT_FOUND",
        severity: "error",
        field: "department",
        message: `Department "${mapped.department}" was not found.`,
      })
    }

    const position = mapped.position
      ? resolvePosition(mapped.position, department?.id, masterData)
      : undefined
    if (mapped.position && !position) {
      messages.push({
        code: "POSITION_NOT_FOUND",
        severity: "error",
        field: "position",
        message: `Position "${mapped.position}" was not found${department ? " in this department" : ""}.`,
      })
    }

    const company = mapped.company ? resolveCompany(mapped.company, masterData) : undefined
    if (mapped.company && !company) {
      messages.push({
        code: "COMPANY_NOT_FOUND",
        severity: "error",
        field: "company",
        message: `Company "${mapped.company}" was not found.`,
      })
    }

    const branch = mapped.branch ? resolveBranch(mapped.branch, company?.id, masterData) : undefined
    if (mapped.branch && !branch) {
      messages.push({
        code: "BRANCH_NOT_FOUND",
        severity: "error",
        field: "branch",
        message: `Branch "${mapped.branch}" was not found${company ? " for this company" : ""}.`,
      })
    }

    const manager = mapped.manager ? resolveManager(mapped.manager, masterData) : undefined
    if (mapped.manager && !manager) {
      messages.push({
        code: "MANAGER_NOT_FOUND",
        severity: "error",
        field: "manager",
        message: `Manager "${mapped.manager}" was not found.`,
      })
    }

    const workSchedule = mapped.workSchedule ? resolveWorkSchedule(mapped.workSchedule, masterData) : undefined
    if (mapped.workSchedule && !workSchedule) {
      messages.push({
        code: "WORK_SCHEDULE_CUSTOM",
        severity: "info",
        field: "workSchedule",
        message: `Work Schedule "${mapped.workSchedule}" doesn't match a known schedule — kept as a custom label.`,
      })
    }

    // FIN uniqueness — in-file duplicates block every row that shares the
    // value (we can't know which is authoritative); a match against the
    // live directory is not an error, it's the idempotency path: the row
    // is skipped at import time rather than creating a duplicate employee.
    if (mapped.finCode) {
      if ((finOccurrences.get(mapped.finCode) ?? 0) > 1) {
        messages.push({
          code: "DUPLICATE_FIN_IN_FILE",
          severity: "error",
          field: "finCode",
          message: `FIN "${mapped.finCode}" appears more than once in this file.`,
        })
      } else if (existingFins.has(mapped.finCode)) {
        messages.push({
          code: "DUPLICATE_FIN_EXISTING",
          severity: "warning",
          field: "finCode",
          message: `An employee with FIN "${mapped.finCode}" already exists — this row will be skipped.`,
        })
      }
    }

    // Employee Number — same generate-or-validate rule as Create/Edit,
    // with the pool growing as each row in the file is assigned one so
    // two rows in the same file can never collide.
    let employeeNumber = mapped.employeeNumber
    if (!employeeNumber) {
      employeeNumber = generateNextEmployeeNumber(Array.from(employeeNumberPool))
      messages.push({
        code: "EMPLOYEE_NUMBER_GENERATED",
        severity: "info",
        field: "employeeNumber",
        message: `Employee Number generated automatically: ${employeeNumber}.`,
      })
    } else if (seenEmployeeNumbersInFile.has(employeeNumber)) {
      messages.push({
        code: "DUPLICATE_EMPLOYEE_NUMBER_IN_FILE",
        severity: "error",
        field: "employeeNumber",
        message: `Employee Number "${employeeNumber}" appears more than once in this file.`,
      })
    } else if (isEmployeeNumberTaken(employeeNumber, Array.from(employeeNumberPool))) {
      messages.push({
        code: "DUPLICATE_EMPLOYEE_NUMBER_EXISTING",
        severity: "error",
        field: "employeeNumber",
        message: `Employee Number "${employeeNumber}" already exists.`,
      })
    }
    employeeNumberPool.add(employeeNumber)
    seenEmployeeNumbersInFile.add(employeeNumber)

    const wizardData: EmployeeWizardData = {
      ...defaultWizardData,
      ...mapped,
      employeeNumber,
      departmentId: department?.id ?? "",
      positionId: position?.id ?? "",
      companyId: company?.id ?? "",
      branchId: branch?.id ?? "",
      managerId: manager?.id ?? "",
      scheduleId: workSchedule ? workSchedule.id : mapped.workSchedule ? CUSTOM_WORK_SCHEDULE_ID : "",
      customWorkScheduleLabel: workSchedule ? "" : (mapped.workSchedule ?? ""),
    }

    const personalErrors = validateWizardStep(0, wizardData, VALIDATION_MESSAGES)
    const employmentErrors = validateWizardStep(1, wizardData, VALIDATION_MESSAGES)
    for (const [field, message] of Object.entries({ ...personalErrors, ...employmentErrors })) {
      messages.push({
        code: "REQUIRED_FIELD_MISSING",
        severity: "error",
        field: field as ImportRowMessage["field"],
        message: `${field}: ${message}`,
      })
    }

    const severity = highestSeverity(messages)
    const willSkipAsDuplicate = messages.some((m) => m.code === "DUPLICATE_FIN_EXISTING")

    results.push({
      rowNumber: row.rowNumber,
      raw: row.cells,
      mapped: wizardData,
      messages,
      severity,
      willImport: severity !== "error",
      willSkipAsDuplicate,
    })

    if (onProgress && (index % 200 === 0 || index === mappedRows.length - 1)) {
      onProgress(index + 1, mappedRows.length)
    }
  })

  return results
}
