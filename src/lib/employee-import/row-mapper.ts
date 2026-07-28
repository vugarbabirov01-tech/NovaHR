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

function normalizeKey(text: string): string {
  return text.trim().toLowerCase().replace(/[\s_-]+/g, "")
}

function cellToString(value: unknown): string {
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

const GENDER_MAP: Record<string, Gender> = {
  male: "male",
  m: "male",
  kişi: "male",
  kisi: "male",
  female: "female",
  f: "female",
  qadın: "female",
  qadin: "female",
}

const MARITAL_MAP: Record<string, MaritalStatus> = {
  single: "single",
  subay: "single",
  married: "married",
  evli: "married",
  divorced: "divorced",
  boşanmış: "divorced",
  bosanmis: "divorced",
  widowed: "widowed",
  dul: "widowed",
}

const EMPLOYMENT_TYPE_MAP: Record<string, EmploymentType> = {
  "full-time": "full-time",
  fulltime: "full-time",
  "part-time": "part-time",
  parttime: "part-time",
  seasonal: "seasonal",
  temporary: "temporary",
  contract: "contract",
  internship: "internship",
}

const CONTRACT_TYPE_MAP: Record<string, ContractType> = {
  permanent: "permanent",
  "fixed-term": "fixed-term",
  fixedterm: "fixed-term",
  "project-based": "project-based",
  projectbased: "project-based",
  internship: "internship",
}

const WORK_LOCATION_TYPE_MAP: Record<string, WorkLocationType> = {
  "on-site": "on-site",
  onsite: "on-site",
  ofisdən: "on-site",
  ofisden: "on-site",
  remote: "remote",
  məsafədən: "remote",
  mesafeden: "remote",
  hybrid: "hybrid",
  "hibrid iş rejimi": "hybrid",
  hibrid: "hybrid",
}

function mapEnum<T extends string>(raw: string, table: Record<string, T>): T | undefined {
  return table[raw.trim().toLowerCase()]
}

/**
 * Common date shapes an HR spreadsheet is likely to contain, tried in
 * order. Excel's own date cells arrive as native Date objects (handled in
 * cellToString) and never reach the string branch below.
 */
function parseImportDate(raw: string): string | null {
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

export interface MappedRow {
  mapped: Partial<EmployeeWizardData> & {
    department: string
    position: string
    company: string
    branch: string
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
 * department/position/company/branch/manager/workSchedule stay as plain
 * text here — resolving them to ids is row-validator's job, since that's
 * where master data is available.
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
    employmentType: text.employmentType ? (mapEnum(text.employmentType, EMPLOYMENT_TYPE_MAP) ?? "") : "",
    contractType: text.contractType ? (mapEnum(text.contractType, CONTRACT_TYPE_MAP) ?? "") : "",
    department: text.department ?? "",
    position: text.position ?? "",
    company: text.company ?? "",
    branch: text.branch ?? "",
    manager: text.manager ?? "",
    workSchedule: text.workSchedule ?? "",
    workLocationType: text.workLocationType
      ? (mapEnum(text.workLocationType, WORK_LOCATION_TYPE_MAP) ?? "")
      : "",
    workLocation: text.workLocation ?? "",
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

  return { mapped, messages }
}
