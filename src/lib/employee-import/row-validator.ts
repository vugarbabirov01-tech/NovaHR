import { validateWizardStep, type WizardValidationMessages } from "@/lib/employee-wizard-validation"
import { generateNextEmployeeNumber } from "@/lib/employees"
import { defaultWizardData, type EmployeeWizardData } from "@/types/employee-wizard"
import { CUSTOM_WORK_SCHEDULE_ID, type WizardMasterData } from "@/lib/employee-wizard-mapper"
import { mapRawRow } from "@/lib/employee-import/row-mapper"
import {
  resolveCompany,
  resolveDepartment,
  resolveManager,
  resolvePosition,
  resolveWorkSchedule,
} from "@/lib/employee-import/master-data-resolver"
import type {
  ImportRow,
  ImportRowMessage,
  ImportSettings,
  ImportSeverity,
  RawImportRow,
} from "@/lib/employee-import/types"
import type { ColumnMapping } from "@/lib/employee-import/types"
import { ImportValidationMessages } from "@/lib/employee-import/validation-messages"

// validateWizardStep needs a "required" message, but the actual per-field
// AZ text is built afterward from each error's field key (see the
// REQUIRED_FIELD_MISSING loop below) — this placeholder is never shown to
// a user, it only has to be a non-empty string so validateWizardStep
// reports the field as invalid at all.
const VALIDATION_MESSAGES: WizardValidationMessages = { required: "required" }

const SEVERITY_RANK: Record<ImportSeverity, number> = { info: 0, warning: 1, error: 2 }

function highestSeverity(messages: ImportRowMessage[]): ImportSeverity {
  return messages.reduce<ImportSeverity>(
    (max, message) => (SEVERITY_RANK[message.severity] > SEVERITY_RANK[max] ? message.severity : max),
    "info"
  )
}

/** What Validate needs to know about an employee already in the directory — enough for FIN idempotency (§14) and the Existing-vs-Excel salary comparison (§13), without handing the validator the whole live profile. */
export interface ExistingEmployeeSummary {
  id: string
  baseSalary: number
}

/**
 * Validates every row of an uploaded file in one pass. Reuses
 * validateWizardStep (Personal + Employment only — Payroll/Labour Law stay
 * untouched, see types.ts) and generateNextEmployeeNumber/
 * isEmployeeNumberTaken exactly as Employee Create/Edit do; nothing here
 * duplicates that logic. Import-specific checks (FIN/master-data
 * existence, idempotency) are the only new rules.
 *
 * `masterData` is expected to already be the post-auto-create snapshot
 * (reference-data-auto-resolver.ts has run) — so a DEPARTMENT/POSITION/
 * COMPANY "not found" here is only ever a defensive fallback path, not
 * the normal case. Email is deliberately excluded from
 * REQUIRED_FIELD_MISSING (a real email can't be fabricated the way a
 * default department/employment type can) — row-mapper already recorded a
 * non-blocking EMAIL_MISSING warning for a blank cell.
 */
export function validateImportRows(
  rawRows: RawImportRow[],
  columnMapping: ColumnMapping[],
  masterData: WizardMasterData,
  existingEmployeesByFin: ReadonlyMap<string, ExistingEmployeeSummary>,
  existingEmployeeNumbers: ReadonlySet<string>,
  settings: ImportSettings,
  onProgress?: (processed: number, total: number) => void
): ImportRow[] {
  const mappedRows = rawRows.map((row) => ({ row, ...mapRawRow(row, columnMapping) }))

  const finOccurrences = new Map<string, number>()
  for (const { mapped } of mappedRows) {
    if (!mapped.finCode) continue
    finOccurrences.set(mapped.finCode, (finOccurrences.get(mapped.finCode) ?? 0) + 1)
  }

  const existingNumberSet = new Set(existingEmployeeNumbers)
  const employeeNumberPool = new Set(existingEmployeeNumbers)
  const seenEmployeeNumbersInFile = new Set<string>()
  const results: ImportRow[] = []

  mappedRows.forEach(({ row, mapped, messages: normalizationMessages }, index) => {
    const messages: ImportRowMessage[] = [...normalizationMessages]

    const department = mapped.department ? resolveDepartment(mapped.department, masterData) : undefined
    if (mapped.department && !department) {
      messages.push({
        code: "DEPARTMENT_WILL_BE_CREATED",
        severity: "info",
        field: "department",
        message: ImportValidationMessages.departmentWillBeCreated(mapped.department),
      })
    }

    const position = mapped.position
      ? resolvePosition(mapped.position, department?.id, masterData)
      : undefined
    if (mapped.position && !position) {
      messages.push({
        code: "POSITION_WILL_BE_CREATED",
        severity: "info",
        field: "position",
        message: ImportValidationMessages.positionWillBeCreated(mapped.position, Boolean(department)),
      })
    }

    const company = mapped.company ? resolveCompany(mapped.company, masterData) : undefined
    if (mapped.company && !company) {
      messages.push({
        code: "COMPANY_WILL_BE_CREATED",
        severity: "info",
        field: "company",
        message: ImportValidationMessages.companyWillBeCreated(mapped.company),
      })
    }

    const manager = mapped.manager ? resolveManager(mapped.manager, masterData) : undefined
    if (mapped.manager && !manager) {
      messages.push({
        code: "MANAGER_NOT_FOUND",
        severity: "warning",
        field: "manager",
        message: ImportValidationMessages.managerNotFound(mapped.manager),
      })
    }

    const workSchedule = mapped.workSchedule ? resolveWorkSchedule(mapped.workSchedule, masterData) : undefined
    if (mapped.workSchedule && !workSchedule) {
      messages.push({
        code: "WORK_SCHEDULE_CUSTOM",
        severity: "info",
        field: "workSchedule",
        message: ImportValidationMessages.workScheduleCustom(mapped.workSchedule),
      })
    }

    // FIN uniqueness — in-file duplicates block every row that shares the
    // value (we can't know which is authoritative); a match against the
    // live directory is not an error — it's the Skip/Update-existing path
    // (§14), resolved against `settings` at import time by import-service.
    const finCode = mapped.finCode
    const finIsDuplicateInFile = Boolean(finCode && (finOccurrences.get(finCode) ?? 0) > 1)
    const existingEmployee = finCode ? existingEmployeesByFin.get(finCode) : undefined

    if (mapped.finCode) {
      if (finIsDuplicateInFile) {
        messages.push({
          code: "DUPLICATE_FIN_IN_FILE",
          severity: "error",
          field: "finCode",
          message: ImportValidationMessages.duplicateFinInFile(mapped.finCode),
        })
      } else if (existingEmployee) {
        messages.push({
          code: "DUPLICATE_FIN_EXISTING",
          severity: "warning",
          field: "finCode",
          message: ImportValidationMessages.duplicateFinExisting(mapped.finCode),
        })

        const excelSalary = typeof mapped.baseSalary === "number" ? mapped.baseSalary : undefined
        if (settings.existingEmployeeStrategy === "update" && excelSalary && existingEmployee.baseSalary > 0) {
          messages.push(
            settings.salaryStrategy === "updateFromExcel"
              ? {
                  code: "SALARY_WILL_UPDATE",
                  severity: "info",
                  field: "salary",
                  message: ImportValidationMessages.salaryWillUpdate(existingEmployee.baseSalary, excelSalary, mapped.currency ?? "AZN"),
                }
              : {
                  code: "SALARY_EXISTING_KEPT",
                  severity: "info",
                  field: "salary",
                  message: ImportValidationMessages.salaryExistingKept(existingEmployee.baseSalary, excelSalary, mapped.currency ?? "AZN"),
                }
          )
        }
      }
    }

    // Employee Number — same generate-or-validate rule as Create/Edit,
    // with the pool growing as each row in the file is assigned one so
    // two rows in the same file can never collide. An existing employee's
    // own number, or an update-mode row, is not a real conflict — that
    // employee already legitimately holds it.
    let employeeNumber = mapped.employeeNumber
    if (!employeeNumber) {
      employeeNumber = generateNextEmployeeNumber(Array.from(employeeNumberPool))
      messages.push({
        code: "EMPLOYEE_NUMBER_GENERATED",
        severity: "info",
        field: "employeeNumber",
        message: ImportValidationMessages.employeeNumberGenerated(employeeNumber),
      })
    } else if (seenEmployeeNumbersInFile.has(employeeNumber)) {
      messages.push({
        code: "DUPLICATE_EMPLOYEE_NUMBER_IN_FILE",
        severity: "error",
        field: "employeeNumber",
        message: ImportValidationMessages.duplicateEmployeeNumberInFile(employeeNumber),
      })
    } else if (!existingEmployee && existingNumberSet.has(employeeNumber)) {
      messages.push({
        code: "DUPLICATE_EMPLOYEE_NUMBER_EXISTING",
        severity: "error",
        field: "employeeNumber",
        message: ImportValidationMessages.duplicateEmployeeNumberExisting(employeeNumber),
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
      managerId: manager?.id ?? "",
      scheduleId: workSchedule ? workSchedule.id : mapped.workSchedule ? CUSTOM_WORK_SCHEDULE_ID : "",
      customWorkScheduleLabel: workSchedule ? "" : (mapped.workSchedule ?? ""),
      salaryEffectiveDate: mapped.salaryEffectiveDate || settings.defaultSalaryStartDate,
    }

    const personalErrors = validateWizardStep(0, wizardData, VALIDATION_MESSAGES)
    delete personalErrors.email // blank email is EMAIL_MISSING (warning), never blocking — see file header.
    const employmentErrors = validateWizardStep(1, wizardData, VALIDATION_MESSAGES)
    for (const field of Object.keys({ ...personalErrors, ...employmentErrors })) {
      messages.push({
        code: "REQUIRED_FIELD_MISSING",
        severity: "error",
        field: field as ImportRowMessage["field"],
        message: ImportValidationMessages.requiredField(field),
      })
    }

    const severity = highestSeverity(messages)
    const willSkipAsDuplicate = Boolean(existingEmployee) && settings.existingEmployeeStrategy === "skip"

    results.push({
      rowNumber: row.rowNumber,
      raw: row.cells,
      mapped: wizardData,
      messages,
      severity,
      willImport: severity !== "error",
      willSkipAsDuplicate,
      existingEmployeeId: existingEmployee?.id,
      existingSalary: existingEmployee?.baseSalary,
    })

    if (onProgress && (index % 200 === 0 || index === mappedRows.length - 1)) {
      onProgress(index + 1, mappedRows.length)
    }
  })

  return results
}
