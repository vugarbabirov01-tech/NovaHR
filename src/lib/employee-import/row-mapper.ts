import type {
  ContractType,
  EmploymentType,
  Gender,
  MaritalStatus,
  WorkLocationType,
} from "@/types/employee-profile"
import type { EmployeeWizardData } from "@/types/employee-wizard"
import type { ColumnMapping, ImportRowMessage, ImportableField, RawImportRow } from "@/lib/employee-import/types"
import { ImportValidationMessages } from "@/lib/employee-import/validation-messages"
import {
  CONTRACT_TYPE_VALUE_LABELS,
  EMPLOYMENT_TYPE_VALUE_LABELS,
  GENDER_VALUE_LABELS,
  MARITAL_STATUS_VALUE_LABELS,
  WORK_LOCATION_TYPE_VALUE_LABELS,
} from "@/lib/employee-import/column-mapping"
import { FALLBACK_DEPARTMENT_NAME } from "@/lib/employee-import/reference-data-fallbacks"

/**
 * The default every closed-enum field falls back to when the Excel cell is
 * blank or its text doesn't match any known label — matches
 * wizardDataToProfile's own post-hoc defaults (employee-wizard-mapper.ts),
 * just applied earlier so validateWizardStep never sees an empty value to
 * reject. Always paired with a non-blocking WARNING (row-validator.ts) so
 * the assumption is visible, never silent.
 */
const DEFAULT_EMPLOYMENT_TYPE: EmploymentType = "full-time"
const DEFAULT_CONTRACT_TYPE: ContractType = "permanent"
const DEFAULT_WORK_LOCATION_TYPE: WorkLocationType = "on-site"

function normalizeKey(text: string): string {
  return text.trim().toLowerCase().replace(/[\s_-]+/g, "")
}

function cellToString(value: unknown): string {
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

/**
 * Seeds a recognition map from a field's canonical AZ export label
 * (column-mapping.ts) — so anything Export just wrote, or a value copy-
 * pasted from an already-filled row in the same template, always reads
 * back correctly — then layers `extraAliases` (English words, common
 * abbreviations, diacritic-free spellings) on top for real-world files
 * that don't use the exact export wording. Building it this way means the
 * canonical label can never drift out of sync with what Import accepts,
 * the same guarantee suggestFieldForColumn already gives column headers.
 */
function buildEnumMap<T extends string>(
  canonicalLabels: Record<T, string>,
  extraAliases: Record<string, T>
): Record<string, T> {
  const map: Record<string, T> = {}
  for (const [code, label] of Object.entries(canonicalLabels) as [T, string][]) {
    map[label.trim().toLowerCase()] = code
  }
  return { ...map, ...extraAliases }
}

const GENDER_MAP: Record<string, Gender> = buildEnumMap<Gender>(GENDER_VALUE_LABELS, {
  male: "male",
  m: "male",
  kisi: "male",
  female: "female",
  f: "female",
  qadin: "female",
})

const MARITAL_MAP: Record<string, MaritalStatus> = buildEnumMap<MaritalStatus>(MARITAL_STATUS_VALUE_LABELS, {
  single: "single",
  married: "married",
  divorced: "divorced",
  bosanmis: "divorced",
  widowed: "widowed",
})

const EMPLOYMENT_TYPE_MAP: Record<string, EmploymentType> = buildEnumMap<EmploymentType>(
  EMPLOYMENT_TYPE_VALUE_LABELS,
  {
    "full-time": "full-time",
    fulltime: "full-time",
    "part-time": "part-time",
    parttime: "part-time",
    seasonal: "seasonal",
    temporary: "temporary",
    contract: "contract",
    internship: "internship",
  }
)

const CONTRACT_TYPE_MAP: Record<string, ContractType> = buildEnumMap<ContractType>(CONTRACT_TYPE_VALUE_LABELS, {
  permanent: "permanent",
  "fixed-term": "fixed-term",
  fixedterm: "fixed-term",
  "project-based": "project-based",
  projectbased: "project-based",
  internship: "internship",
})

const WORK_LOCATION_TYPE_MAP: Record<string, WorkLocationType> = buildEnumMap<WorkLocationType>(
  WORK_LOCATION_TYPE_VALUE_LABELS,
  {
    "on-site": "on-site",
    onsite: "on-site",
    ofisden: "on-site",
    remote: "remote",
    mesafeden: "remote",
    hybrid: "hybrid",
    hibrid: "hybrid",
  }
)

function mapEnum<T extends string>(raw: string, table: Record<string, T>): T | undefined {
  return table[raw.trim().toLowerCase()]
}

/**
 * Common date shapes an HR spreadsheet is likely to contain, tried in
 * order. Excel's own date cells arrive as native Date objects (handled in
 * cellToString) and never reach the string branch below.
 */
export function parseImportDate(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (isoMatch) return value

  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(value)
  if (dmy) {
    const [, day, month, year] = dmy
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)

  return null
}

/**
 * Handles every shape §11 lists: "1200", "1200.00", "1200,00", "1 200",
 * "1 200,50", "1,200". Spaces are always a thousands separator (never
 * meaningful otherwise in a salary cell). With only one separator kind
 * present, a comma/dot is decimal only when it has exactly 1-2 trailing
 * digits ("1200,00" -> 1200.00); otherwise it's thousands ("1,200" -> 1200,
 * matching the spec's own example). With both present, whichever comes
 * last is the decimal separator ("1.200,50" vs "1,200.50"). Returns null
 * for anything that still doesn't parse as a finite number — the caller
 * treats that as SALARY_INVALID rather than silently coercing to 0.
 */
export function parseSalaryAmount(raw: string): number | null {
  let value = raw.trim().replace(/[^\d\s.,-]/g, "").replace(/\s+/g, "")
  if (!value) return null

  const lastComma = value.lastIndexOf(",")
  const lastDot = value.lastIndexOf(".")

  if (lastComma !== -1 && lastDot !== -1) {
    value =
      lastComma > lastDot
        ? value.replace(/\./g, "").replace(",", ".")
        : value.replace(/,/g, "")
  } else if (lastComma !== -1) {
    const decimalDigits = value.length - lastComma - 1
    value = decimalDigits > 0 && decimalDigits <= 2 ? value.replace(",", ".") : value.replace(/,/g, "")
  }

  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export interface MappedRow {
  mapped: Partial<EmployeeWizardData> & {
    department: string
    position: string
    company: string
    manager: string
    workSchedule: string
  }
  messages: ImportRowMessage[]
}

/**
 * Converts one raw sheet row (keyed by original column header) into a
 * Partial<EmployeeWizardData>-shaped object using the user's column
 * mapping, coercing enums/dates and recording a VALUE_NORMALIZED info
 * message wherever the source text didn't already match the target shape
 * exactly (e.g. "male" from "Kişi", or a reformatted date).
 *
 * department/position/company/manager/workSchedule stay as plain text
 * here — resolving them to ids is row-validator's job, since that's where
 * master data is available.
 */
export function mapRawRow(row: RawImportRow, columnMapping: ColumnMapping[]): MappedRow {
  const messages: ImportRowMessage[] = []
  const text: Partial<Record<ImportableField, string>> = {}

  for (const mapping of columnMapping) {
    if (mapping.field === "ignore") continue
    const raw = cellToString(row.cells[mapping.excelColumn])
    if (raw) text[mapping.field] = raw
  }

  function normalized(field: ImportableField, value: string, original: string) {
    if (value !== original) {
      messages.push({
        code: "VALUE_NORMALIZED",
        severity: "info",
        field,
        message: ImportValidationMessages.valueNormalized(field, original, value),
      })
    }
    return value
  }

  const finCode = normalizeKey(text.finCode ?? "").toUpperCase()
  if (text.finCode && finCode !== text.finCode) normalized("finCode", finCode, text.finCode)

  const email = (text.email ?? "").toLowerCase()
  if (text.email && email !== text.email) normalized("email", email, text.email)

  const mapped: MappedRow["mapped"] = {
    firstName: text.firstName ?? "",
    lastName: text.lastName ?? "",
    fatherName: text.fatherName ?? "",
    gender: text.gender ? (mapEnum(text.gender, GENDER_MAP) ?? "") : "",
    dateOfBirth: "",
    nationality: text.nationality ?? "",
    maritalStatus: text.maritalStatus ? (mapEnum(text.maritalStatus, MARITAL_MAP) ?? "") : "",
    finCode,
    nationalId: text.nationalId ?? "",
    passportNumber: text.passportNumber ?? "",
    address: text.address ?? "",
    phone: text.phone ?? "",
    email,
    emergencyContactName: text.emergencyContactName ?? "",
    emergencyContactPhone: text.emergencyContactPhone ?? "",
    emergencyContactRelation: text.emergencyContactRelation ?? "",
    employeeNumber: (text.employeeNumber ?? "").trim(),
    hireDate: "",
    probationEndDate: "",
    employmentType: "",
    contractType: "",
    department: text.department?.trim() || "",
    position: text.position ?? "",
    company: text.company ?? "",
    manager: text.manager ?? "",
    workSchedule: text.workSchedule ?? "",
    workLocationType: "",
    workLocation: text.workLocation ?? "",
    baseSalary: "",
    salaryEffectiveDate: "",
  }

  function defaultEnum<T extends string>(
    field: "employmentType" | "contractType" | "workLocationType",
    rawText: string | undefined,
    table: Record<string, T>,
    fallback: T,
    fallbackLabel: string,
    buildMessage: (rawValue: string | null, defaultLabel: string) => string,
    code: "EMPLOYMENT_TYPE_DEFAULTED" | "CONTRACT_TYPE_DEFAULTED" | "WORK_LOCATION_TYPE_DEFAULTED"
  ): T {
    const matched = rawText ? mapEnum(rawText, table) : undefined
    if (matched) return matched
    messages.push({
      code,
      severity: "warning",
      field,
      message: buildMessage(rawText?.trim() || null, fallbackLabel),
    })
    return fallback
  }

  mapped.employmentType = defaultEnum(
    "employmentType",
    text.employmentType,
    EMPLOYMENT_TYPE_MAP,
    DEFAULT_EMPLOYMENT_TYPE,
    EMPLOYMENT_TYPE_VALUE_LABELS[DEFAULT_EMPLOYMENT_TYPE],
    ImportValidationMessages.employmentTypeDefaulted,
    "EMPLOYMENT_TYPE_DEFAULTED"
  )
  mapped.contractType = defaultEnum(
    "contractType",
    text.contractType,
    CONTRACT_TYPE_MAP,
    DEFAULT_CONTRACT_TYPE,
    CONTRACT_TYPE_VALUE_LABELS[DEFAULT_CONTRACT_TYPE],
    ImportValidationMessages.contractTypeDefaulted,
    "CONTRACT_TYPE_DEFAULTED"
  )
  mapped.workLocationType = defaultEnum(
    "workLocationType",
    text.workLocationType,
    WORK_LOCATION_TYPE_MAP,
    DEFAULT_WORK_LOCATION_TYPE,
    WORK_LOCATION_TYPE_VALUE_LABELS[DEFAULT_WORK_LOCATION_TYPE],
    ImportValidationMessages.workLocationTypeDefaulted,
    "WORK_LOCATION_TYPE_DEFAULTED"
  )

  if (!mapped.department) {
    mapped.department = FALLBACK_DEPARTMENT_NAME
    messages.push({
      code: "DEPARTMENT_DEFAULTED",
      severity: "warning",
      field: "department",
      message: ImportValidationMessages.departmentDefaulted(FALLBACK_DEPARTMENT_NAME),
    })
  }

  if (!mapped.email) {
    messages.push({ code: "EMAIL_MISSING", severity: "warning", field: "email", message: ImportValidationMessages.emailMissing() })
  }

  if (text.salary) {
    const amount = parseSalaryAmount(text.salary)
    if (amount === null) {
      messages.push({
        code: "SALARY_INVALID",
        severity: "warning",
        field: "salary",
        message: ImportValidationMessages.salaryInvalid(text.salary),
      })
    } else {
      mapped.baseSalary = amount
    }
  } else {
    messages.push({ code: "SALARY_MISSING", severity: "warning", field: "salary", message: ImportValidationMessages.salaryMissing() })
  }

  if (text.dateOfBirth) {
    const parsedDate = parseImportDate(text.dateOfBirth)
    if (parsedDate) {
      mapped.dateOfBirth = normalized("dateOfBirth", parsedDate, text.dateOfBirth)
    } else {
      messages.push({
        code: "INVALID_DATE",
        severity: "error",
        field: "dateOfBirth",
        message: ImportValidationMessages.invalidDate("dateOfBirth", text.dateOfBirth),
      })
    }
  }

  if (text.hireDate) {
    const parsedDate = parseImportDate(text.hireDate)
    if (parsedDate) {
      mapped.hireDate = normalized("hireDate", parsedDate, text.hireDate)
    } else {
      messages.push({
        code: "INVALID_DATE",
        severity: "error",
        field: "hireDate",
        message: ImportValidationMessages.invalidDate("hireDate", text.hireDate),
      })
    }
  }

  if (text.probationEndDate) {
    const parsedDate = parseImportDate(text.probationEndDate)
    if (parsedDate) {
      mapped.probationEndDate = normalized("probationEndDate", parsedDate, text.probationEndDate)
    }
    // An unparsable optional date is silently left empty — not required.
  }

  if (text.salaryStartDate) {
    const parsedDate = parseImportDate(text.salaryStartDate)
    if (parsedDate) {
      mapped.salaryEffectiveDate = normalized("salaryStartDate", parsedDate, text.salaryStartDate)
    } else {
      messages.push({
        code: "INVALID_DATE",
        severity: "warning",
        field: "salaryStartDate",
        message: ImportValidationMessages.invalidDate("salaryStartDate", text.salaryStartDate),
      })
    }
  }

  return { mapped, messages }
}
