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
  // Relative calendar ranges (date fields only, no value input) — resolved
  // against "today" at execution time, so a saved report always means
  // "this year", never a frozen year.
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear"

export const OPERATORS_BY_FIELD_TYPE: Record<ReportFieldType, FilterOperator[]> = {
  string: ["equals", "notEquals", "contains", "startsWith", "isEmpty", "isNotEmpty"],
  number: ["equals", "notEquals", "greaterThan", "lessThan", "between", "isEmpty", "isNotEmpty"],
  date: ["equals", "greaterThan", "lessThan", "between", "thisMonth", "lastMonth", "thisYear", "lastYear", "isEmpty", "isNotEmpty"],
  enum: ["equals", "notEquals", "isEmpty", "isNotEmpty"],
}

/** Operators that need no value input at all. */
export const VALUELESS_OPERATORS: FilterOperator[] = ["isEmpty", "isNotEmpty", "thisMonth", "lastMonth", "thisYear", "lastYear"]

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
  /** User-selected KPIs only — the engine always prepends an implicit
   * row-count KPI server-side (see report-execution-service.ts), so it is
   * never part of this saved list. */
  kpis: AnalyticsSpec[]
  /** At most one chart. Null = no chart configured, the same graceful
   * default a report saved before this field existed also reads as. */
  chartConfig: AnalyticsSpec | null
  // pivotConfig (Phase C) is intentionally NOT added here yet — this
  // type is already threaded through report-builder-client.tsx/actions.ts/
  // the repository, none of which are touched until the pivotConfig
  // migration is approved and Stage 3 (UI/Excel/save integration) begins.
  // See PivotSpec below, which stands on its own until then.
}

export interface ReportRow {
  [fieldKey: string]: string | number | null
}

export type AnalyticsAggregation = "count" | "sum" | "avg" | "min" | "max"

/**
 * How a grouped analytics spec buckets rows — chosen automatically from the
 * groupBy field's own registry type (see field-registry.ts's own comment
 * on `groupable`/`aggregations`), never hardcoded per data source:
 *  - "category": the field's distinct raw values (enum, or a registry-
 *    curated categorical string) — capped with a trailing "Other" bucket,
 *    see aggregation-engine.ts.
 *  - "interval": equal-width numeric bins over the filtered set's own
 *    [min,max] — recomputed every time, never a fixed scale.
 *  - "month" / "year": a date field truncated to that granularity.
 */
export type GroupByBucket = "category" | "interval" | "month" | "year"

export type ChartType = "bar" | "line" | "pie"

export interface AnalyticsGroupBy {
  field: string
  bucket: GroupByBucket
  /** Only read when bucket === "interval". Clamped to [2, 20], default 8. */
  bucketCount?: number
  /**
   * Purely presentational — never read by aggregation-engine.ts (optional
   * here on purpose, so engine-level code/tests never need to supply a
   * meaningless value), but lib/validation/reports.ts requires it on any
   * chartConfig actually saved, so a persisted chart always re-renders as
   * the same chart type it was saved with. Which types are offered for a
   * given bucket is a UI/validation rule (bucket "month"/"year" ->
   * bar/line; "category" -> bar/pie; "interval" -> bar only), not an
   * engine concern.
   */
  chartType?: ChartType
  /**
   * How `AnalyticsPoint.percentage` is computed — "all" (default): each
   * point's share of the sum of every point's own value in this result
   * (i.e. of the full breakdown, which equals the filtered row count when
   * aggregation is "count"). "group": reserved for the Phase C pivot
   * (cross-tab) feature, where a point can instead be a share of its own
   * ROW or COLUMN rather than the grand total — for a plain 1-dimensional
   * chart there is only one grouping level, so aggregation-engine.ts
   * currently computes "group" identically to "all" until Phase C gives
   * it a real, distinct meaning.
   */
  percentageBase?: "all" | "group"
}

/**
 * One generic spec, two renderings: no `groupBy` -> a single scalar (a KPI
 * card); with `groupBy` -> a series (a chart). Both are computed by the
 * same aggregation-engine.ts function — there is deliberately no separate
 * "KPI system" and "chart system" in code, only this one shape, per the
 * 2026-11-11 universal-architecture decision.
 */
export interface AnalyticsSpec {
  aggregation: AnalyticsAggregation
  /** Required for every aggregation except "count". Must be a field whose
   * registry entry lists this aggregation in its own `aggregations` array
   * (enforced in lib/validation/reports.ts, never trusted from the client
   * alone) — this is what stops a request from averaging a field like
   * payrollYear that is a numeric identifier, not a real measure. */
  valueField?: string
  groupBy?: AnalyticsGroupBy
}

export interface AnalyticsPoint {
  /** Stable bucket id. For a category bucket this is the field's raw
   * value, or the reserved sentinel "__other__" for the overflow bucket
   * (translated at render time, never baked in server-side — same
   * deferred-translation precedent as enum fields). For month/year this is
   * an ISO-ish "YYYY" or "YYYY-MM". For interval it's a formatted range
   * label (already display-ready, no further translation needed). For a
   * scalar (no groupBy) it is always "total". */
  key: string
  value: number
  /** This point's share of the result's total, as computed per
   * `AnalyticsGroupBy.percentageBase` — 0-100, rounded to 2 decimals, 0
   * (never NaN/Infinity) when the total is 0. Absent for a scalar (no
   * groupBy) result — "percentage of what" has no meaning for a single
   * KPI number. */
  percentage?: number
}

export interface AnalyticsResult {
  spec: AnalyticsSpec
  /** Exactly one point (key "total") when spec.groupBy is absent. */
  points: AnalyticsPoint[]
  /** True when a "category" bucket had more distinct values than the cap
   * and the excess was folded into the trailing "__other__" point. */
  cappedOther: boolean
}

export interface ReportPreviewResult {
  rows: ReportRow[]
  totalCount: number
  /** Index 0 is always the implicit, always-on row-count KPI (see
   * report-execution-service.ts) — never part of the saved `kpis` list,
   * always present even when the user selected zero extra KPIs. */
  kpis: AnalyticsResult[]
  /** Null when no chart is configured for this report. */
  chart: AnalyticsResult | null
  // pivot (Phase C) intentionally not added here yet — see the matching
  // note on ReportBuilderState above.
}

// Phase C (2026-11-11) — two-dimensional cross-tab. Deliberately a
// SEPARATE spec/result shape from AnalyticsSpec/AnalyticsResult rather
// than a generalization of it: a pivot always has exactly two grouping
// dimensions and a sparse cell grid, which doesn't fit the 1D "groupBy
// or not" shape cleanly. Both still go through the SAME per-dimension
// bucket-key mechanism in aggregation-engine.ts (requirement: "1D və 2D
// qruplaşdırma ortaq bucket mexanizmindən istifadə etsin") — only the
// shape of the RESULT differs, not how a single dimension's key is
// computed.

export interface PivotDimension {
  field: string
  bucket: GroupByBucket
  /** Only read when bucket === "interval". Clamped to [2, 20], default 8. */
  bucketCount?: number
}

export interface PivotSpec {
  aggregation: AnalyticsAggregation
  /** Required for every aggregation except "count" — same rule as
   * AnalyticsSpec.valueField, enforced the same way in
   * lib/validation/reports.ts. */
  valueField?: string
  rowDimension: PivotDimension
  columnDimension: PivotDimension
  /**
   * Percentage denominator for every cell — "all" (default): share of the
   * grand total; "row": share of that cell's own row total; "column":
   * share of that cell's own column total. Only ever produced when
   * `aggregation` is "count" or "sum" (see PivotCell.percentage's own
   * comment) — min/max/avg own no sound "percentage of" meaning, so this
   * is simply ignored for those.
   */
  percentageBase?: "all" | "row" | "column"
  /** Purely presentational, same role as AnalyticsGroupBy.chartType — the
   * grouped/clustered chart rendering a pivot's own cross-tab offers. */
  chartType?: ChartType
}

export interface PivotCell {
  rowKey: string
  columnKey: string
  value: number
  /** Present only when spec.aggregation is "count" or "sum" — absent
   * (never a fabricated number) for avg/min/max, where no sound
   * percentage exists. */
  percentage?: number
}

export interface PivotResult {
  spec: PivotSpec
  /** Ordered row/column headers — category axes order by descending row
   * count (with any "__other__" overflow bucket always last); month/year
   * axes order chronologically; interval axes order by ascending numeric
   * range. Mirrors the single-dimension ordering aggregation-engine.ts
   * already used before Phase C, now shared by both. */
  rowKeys: string[]
  columnKeys: string[]
  /**
   * Sparse by design (requirement: "Boş hüceyrələr və həqiqi sıfır
   * nəticələr fərqləndirilsin") — a (rowKey, columnKey) pair with no
   * matching row has NO entry here at all. A renderer must treat "no
   * PivotCell found for this pair" as empty/"—", distinct from an entry
   * whose `value` genuinely computed to 0.
   */
  cells: PivotCell[]
  /** Each row's own total, aggregated directly from every row with that
   * row key (across all columns) — never derived by combining the row's
   * own cell values, so avg/min/max are mathematically correct regardless
   * of how unevenly rows are spread across columns. */
  rowTotals: Record<string, number>
  columnTotals: Record<string, number>
  /** Aggregated from every row included in the pivot (i.e. that has both
   * a non-null row key and column key) — same reasoning as rowTotals. */
  grandTotal: number
  cappedOtherRow: boolean
  cappedOtherColumn: boolean
}
