import {
  contractTypeMessageKeys,
  employmentTypeMessageKeys,
  statusMessageKeys,
  workLocationTypeMessageKeys,
} from "@/lib/employees"
import {
  ORGANIZATION_BRANCH_FIELDS,
  ORGANIZATION_COMPANY_FIELDS,
  ORGANIZATION_DEPARTMENT_FIELDS,
  ORGANIZATION_POSITION_FIELDS,
} from "@/lib/reports/organization-field-registry"
import { LEAVE_REQUEST_FIELDS } from "@/lib/reports/leave-field-registry"
import { PAYROLL_FIELDS } from "@/lib/reports/payroll-field-registry"
import type { ReportDataSourceKey, ReportFieldType } from "@/types/reports"

export type ReportFieldCategory = "personal" | "employment" | "organization" | "leave" | "payroll"

export interface ReportFieldDefinition {
  key: string
  /** Which data source this field belongs to — a selected column/filter/
   * sortBy is only ever valid against the report's own declared
   * dataSource (enforced in lib/validation/reports.ts), never across
   * sources. */
  dataSource: ReportDataSourceKey
  category: ReportFieldCategory
  type: ReportFieldType
  /** Message key under Reports.fields.<labelKey> (az/en/ru). */
  labelKey: string
  /**
   * For type "enum" only — the next-intl namespace that already translates
   * this field's raw values (reused verbatim from whichever module already
   * owns that translation, so a report never invents a second translation
   * of the same status/category).
   */
  enumNamespace?: string
  /**
   * Maps a raw stored value to the message key under enumNamespace, when
   * it differs from the raw value itself (e.g. "full-time" -> "fullTime").
   * Omitted when the raw value already IS the message key.
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
 *  - Documents/Education/Assets/Notes/AuditLog — different data sources
 *    entirely, not planned.
 * Every key here is also checked for uniqueness against every other data
 * source's fields at module load (see the assertion below) — adding a
 * field later never requires touching report-execution-service.ts or the
 * filter engine, only this list (or another source's own registry file)
 * and that source's own flattening function.
 */
export const EMPLOYEE_REPORT_FIELDS: ReportFieldDefinition[] = [
  { key: "firstName", dataSource: "EMPLOYEES", category: "personal", type: "string", labelKey: "firstName" },
  { key: "lastName", dataSource: "EMPLOYEES", category: "personal", type: "string", labelKey: "lastName" },
  { key: "fatherName", dataSource: "EMPLOYEES", category: "personal", type: "string", labelKey: "fatherName" },
  {
    key: "gender",
    dataSource: "EMPLOYEES",
    category: "personal",
    type: "enum",
    labelKey: "gender",
    enumNamespace: "Gender",
    enumValues: ["male", "female"],
  },
  { key: "dateOfBirth", dataSource: "EMPLOYEES", category: "personal", type: "date", labelKey: "dateOfBirth" },
  { key: "age", dataSource: "EMPLOYEES", category: "personal", type: "number", labelKey: "age" },
  { key: "nationality", dataSource: "EMPLOYEES", category: "personal", type: "string", labelKey: "nationality" },
  {
    key: "maritalStatus",
    dataSource: "EMPLOYEES",
    category: "personal",
    type: "enum",
    labelKey: "maritalStatus",
    enumNamespace: "MaritalStatus",
    enumValues: ["single", "married", "divorced", "widowed"],
  },
  { key: "phone", dataSource: "EMPLOYEES", category: "personal", type: "string", labelKey: "phone" },
  { key: "email", dataSource: "EMPLOYEES", category: "personal", type: "string", labelKey: "email" },

  { key: "employeeNumber", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "employeeNumber" },
  { key: "hireDate", dataSource: "EMPLOYEES", category: "employment", type: "date", labelKey: "hireDate" },
  { key: "tenureYears", dataSource: "EMPLOYEES", category: "employment", type: "number", labelKey: "tenureYears" },
  {
    key: "probationEndDate",
    dataSource: "EMPLOYEES",
    category: "employment",
    type: "date",
    labelKey: "probationEndDate",
  },
  {
    key: "employmentType",
    dataSource: "EMPLOYEES",
    category: "employment",
    type: "enum",
    labelKey: "employmentType",
    enumNamespace: "EmploymentType",
    enumKeyMap: employmentTypeMessageKeys,
    enumValues: ["full-time", "part-time", "seasonal", "temporary", "contract", "internship"],
  },
  {
    key: "contractType",
    dataSource: "EMPLOYEES",
    category: "employment",
    type: "enum",
    labelKey: "contractType",
    enumNamespace: "ContractType",
    enumKeyMap: contractTypeMessageKeys,
    enumValues: ["permanent", "fixed-term", "project-based", "internship"],
  },
  {
    key: "employmentStatus",
    dataSource: "EMPLOYEES",
    category: "employment",
    type: "enum",
    labelKey: "employmentStatus",
    enumNamespace: "Status",
    enumKeyMap: statusMessageKeys,
    enumValues: ["active", "probation", "suspended", "terminated", "inactive"],
  },
  { key: "company", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "company" },
  { key: "branch", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "branch" },
  { key: "department", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "department" },
  { key: "position", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "position" },
  { key: "grade", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "grade" },
  { key: "managerName", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "managerName" },
  { key: "workSchedule", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "workSchedule" },
  {
    key: "workLocationType",
    dataSource: "EMPLOYEES",
    category: "employment",
    type: "enum",
    labelKey: "workLocationType",
    enumNamespace: "WorkLocationType",
    enumKeyMap: workLocationTypeMessageKeys,
    enumValues: ["on-site", "remote", "hybrid"],
  },
  { key: "workLocation", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "workLocation" },
]

/** Every field, across every data source — the single registry everything
 * else in src/lib/reports/ reads from. */
export const ALL_REPORT_FIELDS: ReportFieldDefinition[] = [
  ...EMPLOYEE_REPORT_FIELDS,
  ...ORGANIZATION_COMPANY_FIELDS,
  ...ORGANIZATION_BRANCH_FIELDS,
  ...ORGANIZATION_DEPARTMENT_FIELDS,
  ...ORGANIZATION_POSITION_FIELDS,
  ...LEAVE_REQUEST_FIELDS,
  ...PAYROLL_FIELDS,
]

// Fails fast at module load, not at first use — a field key must be unique
// across every data source (see each registry file's own comment on why
// keys are prefixed, e.g. "companyName" not "name"). This is the server-
// side guarantee behind "unique keys across sources" — a collision can
// never silently ship, the app refuses to even start.
{
  const seen = new Set<string>()
  for (const field of ALL_REPORT_FIELDS) {
    if (seen.has(field.key)) {
      throw new Error(`Report Builder: duplicate field key "${field.key}" across data sources.`)
    }
    seen.add(field.key)
  }
}

const FIELDS_BY_KEY = new Map(ALL_REPORT_FIELDS.map((field) => [field.key, field]))

export function getReportFieldDefinition(key: string): ReportFieldDefinition | undefined {
  return FIELDS_BY_KEY.get(key)
}

export function getFieldsForDataSource(dataSource: ReportDataSourceKey): ReportFieldDefinition[] {
  return ALL_REPORT_FIELDS.filter((field) => field.dataSource === dataSource)
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
