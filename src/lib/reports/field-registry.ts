import {
  contractTypeMessageKeys,
  employmentTypeMessageKeys,
  statusMessageKeys,
  workLocationTypeMessageKeys,
} from "@/lib/employees"
import type { ReportFieldType } from "@/types/reports"

export type ReportFieldCategory = "personal" | "employment"

export interface ReportFieldDefinition {
  key: string
  category: ReportFieldCategory
  type: ReportFieldType
  /** Message key under Reports.fields.<labelKey> (az/en/ru). */
  labelKey: string
  /**
   * For type "enum" only — the next-intl namespace that already translates
   * this field's raw values (reused verbatim from the Employee module, so
   * a report never invents a second translation of "Kişi"/"Male"/"Мужской").
   */
  enumNamespace?: string
  /**
   * Maps a raw EmployeeProfile value to the message key under
   * enumNamespace, when it differs from the raw value itself (e.g.
   * "full-time" -> "fullTime"). Omitted when the raw value already IS the
   * message key (gender, maritalStatus, employmentStatus).
   */
  enumKeyMap?: Record<string, string>
  /** For type "enum" only — every raw value the filter/column UI offers. */
  enumValues?: string[]
}

/**
 * Phase 1, Employees data source only — and deliberately NOT every field on
 * EmployeeProfile. Excluded on purpose, per the approved Phase 1 scope:
 *  - Payroll (baseSalary, bank details, bonus, allowances) — "həssas
 *    məlumat", explicitly out of scope until RBAC exists.
 *  - Legal identifiers (finCode, nationalId, passportNumber, idIssuing*,
 *    address, emergencyContact*) — same "həssas məlumat" reasoning.
 *  - Labour Law section (disability, pregnancy, veteran status, ...) —
 *    same reasoning; also not requested in the approved field list.
 *  - Documents/Education/Assets/Notes/AuditLog/Leave — different data
 *    sources entirely, planned for a later phase, not this one.
 * Adding a field later never requires touching report-execution-service.ts
 * or the filter engine — only this list and employees-report-data-source's
 * flattening function.
 */
export const EMPLOYEE_REPORT_FIELDS: ReportFieldDefinition[] = [
  { key: "firstName", category: "personal", type: "string", labelKey: "firstName" },
  { key: "lastName", category: "personal", type: "string", labelKey: "lastName" },
  { key: "fatherName", category: "personal", type: "string", labelKey: "fatherName" },
  {
    key: "gender",
    category: "personal",
    type: "enum",
    labelKey: "gender",
    enumNamespace: "Gender",
    enumValues: ["male", "female"],
  },
  { key: "dateOfBirth", category: "personal", type: "date", labelKey: "dateOfBirth" },
  { key: "age", category: "personal", type: "number", labelKey: "age" },
  { key: "nationality", category: "personal", type: "string", labelKey: "nationality" },
  {
    key: "maritalStatus",
    category: "personal",
    type: "enum",
    labelKey: "maritalStatus",
    enumNamespace: "MaritalStatus",
    enumValues: ["single", "married", "divorced", "widowed"],
  },
  { key: "phone", category: "personal", type: "string", labelKey: "phone" },
  { key: "email", category: "personal", type: "string", labelKey: "email" },

  { key: "employeeNumber", category: "employment", type: "string", labelKey: "employeeNumber" },
  { key: "hireDate", category: "employment", type: "date", labelKey: "hireDate" },
  { key: "tenureYears", category: "employment", type: "number", labelKey: "tenureYears" },
  { key: "probationEndDate", category: "employment", type: "date", labelKey: "probationEndDate" },
  {
    key: "employmentType",
    category: "employment",
    type: "enum",
    labelKey: "employmentType",
    enumNamespace: "EmploymentType",
    enumKeyMap: employmentTypeMessageKeys,
    enumValues: ["full-time", "part-time", "seasonal", "temporary", "contract", "internship"],
  },
  {
    key: "contractType",
    category: "employment",
    type: "enum",
    labelKey: "contractType",
    enumNamespace: "ContractType",
    enumKeyMap: contractTypeMessageKeys,
    enumValues: ["permanent", "fixed-term", "project-based", "internship"],
  },
  {
    key: "employmentStatus",
    category: "employment",
    type: "enum",
    labelKey: "employmentStatus",
    enumNamespace: "Status",
    enumKeyMap: statusMessageKeys,
    enumValues: ["active", "probation", "suspended", "terminated", "inactive"],
  },
  { key: "company", category: "employment", type: "string", labelKey: "company" },
  { key: "branch", category: "employment", type: "string", labelKey: "branch" },
  { key: "department", category: "employment", type: "string", labelKey: "department" },
  { key: "position", category: "employment", type: "string", labelKey: "position" },
  { key: "grade", category: "employment", type: "string", labelKey: "grade" },
  { key: "managerName", category: "employment", type: "string", labelKey: "managerName" },
  { key: "workSchedule", category: "employment", type: "string", labelKey: "workSchedule" },
  {
    key: "workLocationType",
    category: "employment",
    type: "enum",
    labelKey: "workLocationType",
    enumNamespace: "WorkLocationType",
    enumKeyMap: workLocationTypeMessageKeys,
    enumValues: ["on-site", "remote", "hybrid"],
  },
  { key: "workLocation", category: "employment", type: "string", labelKey: "workLocation" },
]

const FIELDS_BY_KEY = new Map(EMPLOYEE_REPORT_FIELDS.map((field) => [field.key, field]))

export function getReportFieldDefinition(key: string): ReportFieldDefinition | undefined {
  return FIELDS_BY_KEY.get(key)
}

/**
 * Builds the dotted message path (e.g. "EmploymentType.fullTime") for one
 * enum field's raw value, for use with next-intl's namespace-less
 * `useTranslations()` root translator — the one call site that lets a
 * single hook call translate values from however many different
 * namespaces a report's selected columns happen to span, instead of one
 * `useTranslations(namespace)` call per field. Returns null for a
 * non-enum field or an empty raw value, so callers can fall back to the
 * raw value unchanged.
 */
export function getEnumMessagePath(definition: ReportFieldDefinition, rawValue: string): string | null {
  if (!definition.enumNamespace || !rawValue) return null
  const messageKey = definition.enumKeyMap?.[rawValue] ?? rawValue
  return `${definition.enumNamespace}.${messageKey}`
}
