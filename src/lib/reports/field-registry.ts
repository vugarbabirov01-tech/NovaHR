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
  /**
   * For type "number" only — which aggregations the universal analytics
   * engine (aggregation-engine.ts) may apply to this field as a KPI/chart
   * value. Omitted (or empty) means the field is a numeric identifier or
   * count, not a measure — e.g. payrollYear/payrollMonth deliberately have
   * no entry here, so they can never be averaged/summed even though
   * they're type "number". "count" is always available for every field
   * regardless of this list (it never reads valueField).
   */
  aggregations?: ("sum" | "avg" | "min" | "max")[]
  /**
   * For type "string" fields that are curated, bounded categories (e.g.
   * "department", "leaveTypeName") — never free text (email, phone, a
   * name) — marks this field as a valid `groupBy` target for charts/
   * breakdowns. Every type "enum" field is already implicitly groupable
   * (it has a bounded, known value set by definition) without needing this
   * flag — see lib/validation/reports.ts and the chart UI, which both
   * treat "enum" as groupable unconditionally.
   */
  groupable?: boolean
  /**
   * For type "number" only — how a raw numeric value should be rendered
   * for a human (lib/reports/analytics-format.ts is the one place that
   * reads this, for a KPI card, chart, pivot cell, or Excel Summary row
   * alike) — never baked into the stored row itself, same
   * deferred-rendering precedent as an enum's enumNamespace:
   *  - "durationMonths": the field counts total months — rendered as
   *    "X il Y ay" (buildDurationFormatter), however it was aggregated.
   *  - "age": rendered as a locale-formatted number plus the translated
   *    "age" unit word (Reports.fields.unitSuffix.age), e.g. "42,3 yaş".
   * Filtering/sorting/aggregating a field still works on the raw number
   * regardless of this flag — it only changes the displayed TEXT.
   */
  displayUnit?: "durationMonths" | "age"
  /**
   * Marks this field as a technical duplicate of a clearer one (2026-11-11
   * correction — "İş stajı (onluq il)"/"İş stajı (il)" showing alongside
   * "İş stajı" in the same picker confused users). The field named here
   * MUST exist in this same data source. getAggregatableFieldsForDataSource
   * (the one function every KPI/chart/pivot "pick a new stat" picker
   * calls) excludes any field that sets this — but the field itself is
   * NEVER removed from the registry, so an existing saved report's
   * filter/column/KPI still resolves it exactly as before (geriyə
   * uyğunluq). A superseded field's own `aggregations`/`groupable` stay
   * as they are; only its visibility in the "add a new stat" pickers
   * changes.
   */
  supersededByField?: string
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
  {
    key: "age",
    dataSource: "EMPLOYEES",
    category: "personal",
    type: "number",
    labelKey: "age",
    aggregations: ["avg", "min", "max"],
    displayUnit: "age",
  },
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
  {
    key: "tenureYears",
    dataSource: "EMPLOYEES",
    category: "employment",
    type: "number",
    labelKey: "tenureYears",
    aggregations: ["avg", "min", "max"],
    // 2026-11-11: superseded by tenureDurationMonths in every "pick a new
    // stat" picker — three near-identical tenure fields shown side by
    // side ("İş stajı (il)"/"(onluq il)"/plain) was the reported
    // confusion. Still a fully valid filter/column/sort field, and any
    // report saved before this change keeps resolving it unchanged.
    supersededByField: "tenureDurationMonths",
  },
  /** Decimal-precision companion to tenureYears (whole years, unchanged
   * above for backward compatibility with existing saved reports) — e.g.
   * 10.92 instead of 10, for filters/KPIs that need sub-year precision.
   * Also superseded by tenureDurationMonths — see that flag's comment on
   * tenureYears above. */
  {
    key: "tenureYearsDecimal",
    dataSource: "EMPLOYEES",
    category: "employment",
    type: "number",
    labelKey: "tenureYearsDecimal",
    aggregations: ["avg", "min", "max"],
    supersededByField: "tenureDurationMonths",
  },
  /** Total whole months of tenure — rendered as "X il Y ay" at display
   * time via displayUnit: "durationMonths" (see that flag's own
   * comment) — the one tenure field actually offered in "pick a new
   * stat" pickers. */
  {
    key: "tenureDurationMonths",
    dataSource: "EMPLOYEES",
    category: "employment",
    type: "number",
    labelKey: "tenureDurationMonths",
    aggregations: ["avg", "min", "max"],
    displayUnit: "durationMonths",
  },
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
  { key: "company", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "company", groupable: true },
  { key: "branch", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "branch", groupable: true },
  { key: "department", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "department", groupable: true },
  { key: "position", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "position", groupable: true },
  { key: "grade", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "grade", groupable: true },
  { key: "managerName", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "managerName" },
  { key: "workSchedule", dataSource: "EMPLOYEES", category: "employment", type: "string", labelKey: "workSchedule", groupable: true },
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

// Universal analytics metadata helpers (2026-11-11) — every KPI/chart
// validity check (lib/validation/reports.ts) and every analytics picker UI
// goes through these, never a per-data-source branch. A field is groupable
// as a category either because it's curated as such (`groupable: true`,
// see each registry file's own comment) or because its type is "enum" —
// every enum has a bounded, known value set by definition, so no explicit
// flag is needed for it.

export function isFieldCategoryGroupable(field: ReportFieldDefinition): boolean {
  return field.type === "enum" || field.groupable === true
}

/** Every field of this data source that a chart/breakdown can group by —
 * category fields (enum/curated string), date fields (month/year), and
 * number fields (interval/histogram). The chart UI picks the bucket kind
 * from whichever of these the chosen field's own type is. */
export function getGroupableFieldsForDataSource(dataSource: ReportDataSourceKey): ReportFieldDefinition[] {
  return getFieldsForDataSource(dataSource).filter(
    (field) => isFieldCategoryGroupable(field) || field.type === "date" || field.type === "number"
  )
}

/** Every field of this data source that may be used as a KPI/chart VALUE
 * field (i.e. has at least one allowed aggregation) — payrollYear/
 * payrollMonth, for example, are type "number" but never appear here.
 * Also excludes any field marked `supersededByField` (2026-11-11) — a
 * technical duplicate of a clearer field (e.g. tenureYears/
 * tenureYearsDecimal next to tenureDurationMonths) never appears as a
 * choice in a "pick a new stat" picker, though it remains fully valid as
 * a filter/column/sort field and in any report saved before this change.
 */
export function getAggregatableFieldsForDataSource(dataSource: ReportDataSourceKey): ReportFieldDefinition[] {
  return getFieldsForDataSource(dataSource).filter((field) => (field.aggregations?.length ?? 0) > 0 && !field.supersededByField)
}

export function isAggregationAllowedForField(fieldKey: string, aggregation: string): boolean {
  if (aggregation === "count") return true
  const field = getReportFieldDefinition(fieldKey)
  return field ? (field.aggregations ?? []).includes(aggregation as never) : false
}

/** Which GroupByBucket kinds are valid for this field's own type — the
 * single source of truth both validation and the chart UI read, so a
 * number field can never be offered "category" or a date field "interval". */
export function allowedBucketsForField(field: ReportFieldDefinition): ("category" | "interval" | "month" | "year")[] {
  if (isFieldCategoryGroupable(field)) return ["category"]
  if (field.type === "date") return ["month", "year"]
  if (field.type === "number") return ["interval"]
  return []
}

/**
 * Which chart visuals make sense for a given bucket kind — a time-as-pie-
 * slices or a category-as-line-series chart is misleading, so each bucket
 * only offers the chart types that are actually meaningful for it. Both
 * lib/validation/reports.ts and the chart panel UI read this, never a
 * hardcoded switch duplicated in each.
 */
export function allowedChartTypesForBucket(bucket: "category" | "interval" | "month" | "year"): ("bar" | "line" | "pie")[] {
  if (bucket === "category") return ["bar", "pie"]
  if (bucket === "month" || bucket === "year") return ["bar", "line"]
  return ["bar"] // interval (histogram)
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
