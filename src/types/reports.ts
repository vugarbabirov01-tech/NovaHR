// Report Builder — Phase 1 shared types. Deliberately independent of
// EmployeeProfile's own shape: a report field is a flat, display-oriented
// concept (key/type/label), not a path into the nested profile — that
// mapping lives in src/lib/reports/employees-report-data-source.ts, the
// only place that ever reads EmployeeProfile directly for reporting.

export type ReportDataSourceKey =
  | "EMPLOYEES"
  | "COMPANIES"
  | "BRANCHES"
  | "DEPARTMENTS"
  | "POSITIONS"
  | "LEAVE_REQUESTS"
  | "PAYROLL"

export const ALL_DATA_SOURCE_KEYS: ReportDataSourceKey[] = [
  "EMPLOYEES",
  "COMPANIES",
  "BRANCHES",
  "DEPARTMENTS",
  "POSITIONS",
  "LEAVE_REQUESTS",
  "PAYROLL",
]

/** PAYROLL is dev-only until real authentication/RBAC exists (see
 * payroll-report-data-source.ts) — this is the one place both the data
 * source selector (client) and the server actions (server) agree on which
 * sources are actually selectable right now, so the two can never drift. */
export function isDataSourceAvailable(dataSource: ReportDataSourceKey): boolean {
  if (dataSource === "PAYROLL") return process.env.NODE_ENV !== "production"
  return true
}

export type ReportFieldType = "string" | "number" | "date" | "enum"

export type FilterOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "startsWith"
  | "greaterThan"
  | "lessThan"
  | "between"
  | "isEmpty"
  | "isNotEmpty"

export const OPERATORS_BY_FIELD_TYPE: Record<ReportFieldType, FilterOperator[]> = {
  string: ["equals", "notEquals", "contains", "startsWith", "isEmpty", "isNotEmpty"],
  number: ["equals", "notEquals", "greaterThan", "lessThan", "between", "isEmpty", "isNotEmpty"],
  date: ["equals", "greaterThan", "lessThan", "between", "isEmpty", "isNotEmpty"],
  enum: ["equals", "notEquals", "isEmpty", "isNotEmpty"],
}

/** Operators that need no value input at all. */
export const VALUELESS_OPERATORS: FilterOperator[] = ["isEmpty", "isNotEmpty"]

/** A single flat condition. Phase 1 combines every filter in a report with
 * AND only — nested AND/OR groups are a later phase. */
export interface ReportFilter {
  field: string
  operator: FilterOperator
  value?: string | number | null
  /** Only read when operator === "between". */
  valueTo?: string | number | null
}

/** A selected column is just a field key — display order is array order. */
export type ReportColumn = string

export interface ReportBuilderState {
  dataSource: ReportDataSourceKey
  columns: ReportColumn[]
  filters: ReportFilter[]
  sortBy: string | null
  sortDirection: "asc" | "desc"
}

export interface ReportRow {
  [fieldKey: string]: string | number | null
}

export interface ReportPreviewResult {
  rows: ReportRow[]
  totalCount: number
}
