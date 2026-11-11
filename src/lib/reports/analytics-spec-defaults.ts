import { allowedBucketsForField, allowedChartTypesForBucket, getReportFieldDefinition } from "@/lib/reports/field-registry"
import type { AnalyticsSpec } from "@/types/reports"

/**
 * Builds (or updates) the `groupBy` half of a chart spec for a newly
 * chosen field — the one place that decides a sensible bucket/chartType
 * default, reused by both the full Pro chart config panel and Simple
 * mode's lighter comparison picker so a field picked in either UI behaves
 * identically. When `previous` already has a groupBy, its own
 * bucket/chartType/bucketCount/aggregation/valueField are kept whenever
 * they're still valid for the newly chosen field — e.g. switching from one
 * category field to another keeps "bar chart, count" rather than
 * resetting to Simple mode's own defaults, so a Pro-mode customization
 * survives a field change made from either view (both are views over the
 * same state, see report-builder-client.tsx's own comment on that).
 */
export function buildChartSpecForField(fieldKey: string, previous?: AnalyticsSpec | null): AnalyticsSpec {
  const fieldDef = getReportFieldDefinition(fieldKey)
  if (!fieldDef) throw new Error(`buildChartSpecForField: unknown field "${fieldKey}".`)

  const buckets = allowedBucketsForField(fieldDef)
  const previousBucket = previous?.groupBy?.bucket
  const bucket = previousBucket && buckets.includes(previousBucket) ? previousBucket : buckets[0]

  const chartTypes = allowedChartTypesForBucket(bucket)
  const previousChartType = previous?.groupBy?.chartType
  const chartType = previousChartType && chartTypes.includes(previousChartType) ? previousChartType : chartTypes[0]

  const aggregation = previous?.aggregation ?? "count"

  return {
    aggregation,
    valueField: aggregation === "count" ? undefined : previous?.valueField,
    groupBy: {
      field: fieldKey,
      bucket,
      chartType,
      bucketCount: bucket === "interval" ? (previous?.groupBy?.bucketCount ?? 8) : undefined,
      percentageBase: previous?.groupBy?.percentageBase,
    },
  }
}
