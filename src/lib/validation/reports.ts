import { z } from "zod"

import {
  ALL_DATA_SOURCE_KEYS,
  OPERATORS_BY_FIELD_TYPE,
  isDataSourceAvailable,
  type AnalyticsSpec,
  type FilterOperator,
  type PivotSpec,
  type ReportDataSourceKey,
} from "@/types/reports"
import {
  allowedBucketsForField,
  allowedChartTypesForBucket,
  getReportFieldDefinition,
  isAggregationAllowedForField,
} from "@/lib/reports/field-registry"

// Shared validation for the Report Builder's Server Actions. Every field
// key and operator is checked against the field registry here — a
// request naming an unknown field, an operator that field's own type
// doesn't support (e.g. "contains" on a date), or a field that belongs to
// a DIFFERENT data source than the one the request declares, is rejected
// before it ever reaches the filter engine. This is also the one place
// that keeps the Report Builder from ever becoming "pass the user's own
// query to the database": the only things a request can express are a
// whitelisted field (of the right data source), a whitelisted operator
// for that field's type, and a plain value.

const DATA_SOURCE_KEYS = ALL_DATA_SOURCE_KEYS as [ReportDataSourceKey, ...ReportDataSourceKey[]]

const ALL_OPERATORS = Array.from(new Set(Object.values(OPERATORS_BY_FIELD_TYPE).flat())) as [
  FilterOperator,
  ...FilterOperator[],
]

export const reportFilterSchema = z
  .object({
    field: z.string().min(1),
    operator: z.enum(ALL_OPERATORS),
    value: z.union([z.string(), z.number()]).nullable().optional(),
    valueTo: z.union([z.string(), z.number()]).nullable().optional(),
  })
  .refine(
    (filter) => {
      const definition = getReportFieldDefinition(filter.field)
      if (!definition) return false
      return OPERATORS_BY_FIELD_TYPE[definition.type].includes(filter.operator as never)
    },
    { message: "Unknown field, or operator not supported for this field's type." }
  )

// Universal analytics (2026-11-11) — one generic spec shape for both KPIs
// and the chart (see AnalyticsSpec's own comment in types/reports.ts).
// Structural shape is checked by zod; which FIELDS a spec may actually
// name is a cross-field check (isAnalyticsSpecValidForDataSource below),
// same precedent as columns/filters/sortBy already have, since validity
// here always depends on the request's own declared dataSource.

const analyticsAggregationSchema = z.enum(["count", "sum", "avg", "min", "max"])
const groupByBucketSchema = z.enum(["category", "interval", "month", "year"])

const analyticsGroupBySchema = z.object({
  field: z.string().min(1),
  bucket: groupByBucketSchema,
  bucketCount: z.number().int().min(2).max(20).optional(),
  chartType: z.enum(["bar", "line", "pie"]),
  percentageBase: z.enum(["all", "group"]).optional(),
})

const analyticsSpecSchema: z.ZodType<AnalyticsSpec> = z
  .object({
    aggregation: analyticsAggregationSchema,
    valueField: z.string().min(1).optional(),
    groupBy: analyticsGroupBySchema.optional(),
  })
  .refine((spec) => spec.aggregation === "count" || !!spec.valueField, {
    message: "valueField is required for every aggregation except count.",
  })

/** A KPI is a scalar — a spec with groupBy would be a chart, not a KPI. */
const kpiSpecSchema = analyticsSpecSchema.refine((spec) => !spec.groupBy, {
  message: "A KPI spec may not have groupBy — that makes it a chart.",
})

/** The chart is always a grouped series — groupBy is required. */
const chartSpecSchema = analyticsSpecSchema.refine((spec) => !!spec.groupBy, {
  message: "chartConfig requires groupBy.",
})

/**
 * The one place that checks a spec's FIELDS against the request's own
 * dataSource and against that field's own aggregation/groupable metadata
 * — reused for every kpis[] entry and for chartConfig, never duplicated
 * per data source (see field-registry.ts's own helpers this calls).
 */
function isAnalyticsSpecValidForDataSource(dataSource: string, spec: AnalyticsSpec): boolean {
  if (spec.aggregation !== "count") {
    if (!spec.valueField) return false
    const valueFieldDef = getReportFieldDefinition(spec.valueField)
    if (!valueFieldDef || valueFieldDef.dataSource !== dataSource) return false
    if (!isAggregationAllowedForField(spec.valueField, spec.aggregation)) return false
  }
  if (spec.groupBy) {
    const groupByDef = getReportFieldDefinition(spec.groupBy.field)
    if (!groupByDef || groupByDef.dataSource !== dataSource) return false
    if (!allowedBucketsForField(groupByDef).includes(spec.groupBy.bucket)) return false
    // chartType is required by chartSpecSchema's own zod shape for any
    // spec that reaches here with a groupBy — re-checked defensively since
    // this function's parameter type (AnalyticsSpec) leaves it optional
    // for aggregation-engine.ts's own, chart-agnostic use.
    if (!spec.groupBy.chartType || !allowedChartTypesForBucket(spec.groupBy.bucket).includes(spec.groupBy.chartType)) return false
  }
  return true
}

// Phase C (2026-11-11) — the 2D pivot spec. Deliberately standalone: not
// yet wired into reportDefinitionInputSchema/reportPreviewInputSchema
// (that happens once the pivotConfig DB column is approved and the UI/
// Excel/save integration stage begins) — but fully specified, validated,
// and tested now so that wiring is a pure plumbing change later, not a
// design one.

const pivotDimensionSchema = z.object({
  field: z.string().min(1),
  bucket: groupByBucketSchema,
  bucketCount: z.number().int().min(2).max(20).optional(),
})

export const pivotSpecSchema = z
  .object({
    aggregation: analyticsAggregationSchema,
    valueField: z.string().min(1).optional(),
    rowDimension: pivotDimensionSchema,
    columnDimension: pivotDimensionSchema,
    percentageBase: z.enum(["all", "row", "column"]).optional(),
    chartType: z.enum(["bar", "line", "pie"]).optional(),
  })
  .refine((spec) => spec.aggregation === "count" || !!spec.valueField, {
    message: "valueField is required for every aggregation except count.",
  })
  .refine((spec) => spec.rowDimension.field !== spec.columnDimension.field, {
    message: "Row and column dimensions must be different fields — a field cross-tabbed against itself is not a meaningful comparison.",
  })

/**
 * Same cross-field philosophy as isAnalyticsSpecValidForDataSource — both
 * dimensions' fields must belong to the declared dataSource and support
 * the bucket kind requested, and any valueField must allow the requested
 * aggregation. Reuses the exact same field-registry helpers, so a pivot
 * can never bypass a restriction (e.g. PAYROLL's missing `aggregations`)
 * that the 1D path already enforces.
 */
export function isPivotSpecValidForDataSource(dataSource: string, spec: PivotSpec): boolean {
  if (spec.aggregation !== "count") {
    if (!spec.valueField) return false
    const valueFieldDef = getReportFieldDefinition(spec.valueField)
    if (!valueFieldDef || valueFieldDef.dataSource !== dataSource) return false
    if (!isAggregationAllowedForField(spec.valueField, spec.aggregation)) return false
  }
  for (const dimension of [spec.rowDimension, spec.columnDimension]) {
    const dimensionDef = getReportFieldDefinition(dimension.field)
    if (!dimensionDef || dimensionDef.dataSource !== dataSource) return false
    if (!allowedBucketsForField(dimensionDef).includes(dimension.bucket)) return false
  }
  return true
}

function isKnownColumn(key: string): boolean {
  return getReportFieldDefinition(key) !== undefined
}

const knownSortBySchema = z
  .string()
  .min(1)
  .refine(isKnownColumn, { message: "Unknown column." })
  .nullable()
  .optional()

const dataSourceSchema = z
  .enum(DATA_SOURCE_KEYS)
  .refine((value) => isDataSourceAvailable(value), { message: "Data source not available." })

/**
 * Every column, every filter's field, and sortBy must belong to the SAME
 * data source the request itself declares — this is what stops a request
 * from mixing fields across sources (e.g. dataSource: "EMPLOYEES" with a
 * "leaveStatus" column) even though "leaveStatus" is itself a real,
 * known key elsewhere in the registry.
 */
function belongsToDataSource(dataSource: string, key: string): boolean {
  return getReportFieldDefinition(key)?.dataSource === dataSource
}

const crossFieldDataSourceCheck = <
  T extends {
    dataSource: string
    columns: string[]
    filters: { field: string }[]
    sortBy?: string | null
    kpis?: AnalyticsSpec[]
    chartConfig?: AnalyticsSpec | null
  },
>(
  input: T
) =>
  input.columns.every((key) => belongsToDataSource(input.dataSource, key)) &&
  input.filters.every((filter) => belongsToDataSource(input.dataSource, filter.field)) &&
  (!input.sortBy || belongsToDataSource(input.dataSource, input.sortBy)) &&
  (input.kpis ?? []).every((spec) => isAnalyticsSpecValidForDataSource(input.dataSource, spec)) &&
  (!input.chartConfig || isAnalyticsSpecValidForDataSource(input.dataSource, input.chartConfig))

export const reportDefinitionInputSchema = z
  .object({
    name: z.string().trim().min(1, "This field is required.").max(120),
    description: z.string().trim().max(500).optional().nullable(),
    dataSource: dataSourceSchema,
    columns: z.array(z.string().min(1)).refine((columns) => columns.every(isKnownColumn), { message: "Unknown column." }),
    filters: z.array(reportFilterSchema),
    sortBy: knownSortBySchema,
    sortDirection: z.enum(["asc", "desc"]).optional(),
    kpis: z.array(kpiSpecSchema).max(8).optional(),
    chartConfig: chartSpecSchema.nullable().optional(),
  })
  .refine(crossFieldDataSourceCheck, {
    message: "Column, filter, sort, KPI, or chart field does not belong to this data source, or uses an aggregation/grouping that field does not allow.",
  })
// 2026-11-11 (requirement 8, explicit user decision): no longer requires
// at least one column/KPI/chart — the implicit row count (always
// computed by executeReport) is itself a valid, saveable report: a user
// who only applies a filter can save/export "just the filtered count".

export const reportPreviewInputSchema = z
  .object({
    dataSource: dataSourceSchema,
    columns: z.array(z.string().min(1)).refine((columns) => columns.every(isKnownColumn), {
      message: "Unknown column.",
    }),
    filters: z.array(reportFilterSchema),
    sortBy: knownSortBySchema,
    sortDirection: z.enum(["asc", "desc"]).optional(),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().max(200).optional(),
    kpis: z.array(kpiSpecSchema).max(8).optional(),
    chartConfig: chartSpecSchema.nullable().optional(),
  })
  .refine(crossFieldDataSourceCheck, {
    message: "Column, filter, sort, KPI, or chart field does not belong to this data source, or uses an aggregation/grouping that field does not allow.",
  })
