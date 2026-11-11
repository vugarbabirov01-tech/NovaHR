"use client"

import { useTranslations } from "next-intl"
import { BarChart3, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/common/empty-state"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { buildChartSpecForField } from "@/lib/reports/analytics-spec-defaults"
import {
  allowedBucketsForField,
  allowedChartTypesForBucket,
  getAggregatableFieldsForDataSource,
  getGroupableFieldsForDataSource,
  getReportFieldDefinition,
} from "@/lib/reports/field-registry"
import type { AnalyticsAggregation, AnalyticsSpec, ChartType, GroupByBucket, ReportDataSourceKey } from "@/types/reports"

interface ReportChartConfigPanelProps {
  dataSource: ReportDataSourceKey
  chartConfig: AnalyticsSpec | null
  onChange: (chartConfig: AnalyticsSpec | null) => void
  /**
   * Simple mode's "Ətraflı tənzimləmələr" reuses this component for just
   * the bucket-kind/bucket-count/chart-type row — the field/aggregation/
   * value-field pickers stay exclusively in report-comparison-picker.tsx
   * there, so the same choice is never shown twice. Pro mode never passes
   * this (shows everything, unchanged).
   */
  detailsOnly?: boolean
}

/**
 * Left-panel CONFIG half of the chart — picks which field/bucket/
 * aggregation/chart-type the chart uses. Renders nothing of the result
 * itself (see report-chart-display.tsx for that, driven by the exact same
 * `chartConfig` this writes). Never branches on dataSource — every select
 * is populated from getGroupableFieldsForDataSource /
 * getAggregatableFieldsForDataSource (field-registry.ts), and which
 * bucket/chart-type options are offered comes from allowedBucketsForField /
 * allowedChartTypesForBucket. A new data source needs zero changes here.
 */
export function ReportChartConfigPanel({ dataSource, chartConfig, onChange, detailsOnly = false }: ReportChartConfigPanelProps) {
  const t = useTranslations("Reports.builder")
  const tAggregation = useTranslations("Reports.builder.aggregation")
  const tFields = useTranslations("Reports.fields")

  const groupableFields = getGroupableFieldsForDataSource(dataSource)
  const aggregatableFields = getAggregatableFieldsForDataSource(dataSource)

  const groupByFieldLabels: Record<string, string> = {}
  for (const field of groupableFields) groupByFieldLabels[field.key] = tFields(field.labelKey)

  if (groupableFields.length === 0) {
    return detailsOnly ? null : <EmptyState icon={BarChart3} title={t("chartTitle")} description={t("chartNoGroupableFieldsDescription")} />
  }

  if (!chartConfig || !chartConfig.groupBy) {
    if (detailsOnly) return null
    return (
      <div className="flex flex-col gap-3">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("chartTitle")}</Label>
        <Select items={groupByFieldLabels} value="" onValueChange={(value) => value && onChange(buildChartSpecForField(value))}>
          <SelectTrigger className="h-8 w-full text-sm">
            <SelectValue placeholder={t("chartGroupByPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {groupableFields.map((field) => (
              <SelectItem key={field.key} value={field.key}>
                {tFields(field.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  // A fresh `const` (never reassigned) so every nested handler below keeps
  // this non-null narrowing — referencing the `chartConfig` prop directly
  // inside a closure would widen back to `AnalyticsSpec | null`, since TS
  // can't prove a parameter binding stays narrowed across a closure
  // boundary the way it can for a const declared right after the guard
  // above (same reasoning as `groupBy` below).
  const config = chartConfig
  const groupBy = chartConfig.groupBy
  const groupByFieldDef = getReportFieldDefinition(groupBy.field)
  const availableBuckets = groupByFieldDef ? allowedBucketsForField(groupByFieldDef) : [groupBy.bucket]
  const availableChartTypes = allowedChartTypesForBucket(groupBy.bucket)
  const currentChartType: ChartType = groupBy.chartType ?? availableChartTypes[0]

  const bucketLabels: Record<string, string> = {}
  for (const bucket of availableBuckets) bucketLabels[bucket] = t(`chartBucket.${bucket}`)
  const chartTypeLabels: Record<string, string> = {}
  for (const type of availableChartTypes) chartTypeLabels[type] = t(`chartType.${type}`)
  const aggregationLabels: Record<string, string> = { count: t("chartAggregationCountLabel") }
  for (const field of aggregatableFields) {
    for (const aggregation of field.aggregations ?? []) aggregationLabels[aggregation] = tAggregation(aggregation)
  }
  const valueFieldCandidates = aggregatableFields.filter((f) => (f.aggregations ?? []).includes(config.aggregation as never))
  const valueFieldLabels: Record<string, string> = {}
  for (const field of valueFieldCandidates) valueFieldLabels[field.key] = tFields(field.labelKey)

  function updateGroupBy(patch: Partial<AnalyticsSpec["groupBy"]>) {
    onChange({ ...config, groupBy: { ...groupBy, ...patch } as NonNullable<AnalyticsSpec["groupBy"]> })
  }

  function handleGroupByFieldChange(fieldKey: string) {
    onChange(buildChartSpecForField(fieldKey, config))
  }

  function handleBucketChange(bucket: GroupByBucket) {
    const chartTypes = allowedChartTypesForBucket(bucket)
    const chartType = chartTypes.includes(currentChartType) ? currentChartType : chartTypes[0]
    updateGroupBy({ bucket, chartType })
  }

  function handleAggregationChange(aggregation: AnalyticsAggregation) {
    if (aggregation === "count") {
      onChange({ ...config, aggregation, valueField: undefined })
      return
    }
    const candidates = aggregatableFields.filter((f) => (f.aggregations ?? []).includes(aggregation))
    const valueField = candidates.some((f) => f.key === config.valueField) ? config.valueField : candidates[0]?.key
    onChange({ ...config, aggregation, valueField })
  }

  return (
    <div className="flex flex-col gap-3">
      {!detailsOnly ? (
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("chartTitle")}</Label>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={t("chartClear")} onClick={() => onChange(null)}>
            <X className="size-3.5" strokeWidth={1.75} />
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {!detailsOnly ? (
          <Select items={groupByFieldLabels} value={groupBy.field} onValueChange={(v) => v && handleGroupByFieldChange(v)}>
            <SelectTrigger className="h-8 w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groupableFields.map((field) => (
                <SelectItem key={field.key} value={field.key}>
                  {tFields(field.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {availableBuckets.length > 1 ? (
            <Select items={bucketLabels} value={groupBy.bucket} onValueChange={(v) => v && handleBucketChange(v as GroupByBucket)}>
              <SelectTrigger className="h-8 w-28 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableBuckets.map((bucket) => (
                  <SelectItem key={bucket} value={bucket}>
                    {t(`chartBucket.${bucket}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {groupBy.bucket === "interval" ? (
            <Input
              type="number"
              min={2}
              max={20}
              value={groupBy.bucketCount ?? 8}
              onChange={(e) => updateGroupBy({ bucketCount: Math.min(20, Math.max(2, Number(e.target.value) || 8)) })}
              className="h-8 w-20 text-sm"
            />
          ) : null}

          <Select items={chartTypeLabels} value={currentChartType} onValueChange={(v) => v && updateGroupBy({ chartType: v as ChartType })}>
            <SelectTrigger className="h-8 w-28 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableChartTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`chartType.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!detailsOnly ? (
          <div className="flex flex-wrap gap-2">
            <Select items={aggregationLabels} value={config.aggregation} onValueChange={(v) => v && handleAggregationChange(v as AnalyticsAggregation)}>
              <SelectTrigger className="h-8 w-28 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count">{t("chartAggregationCountLabel")}</SelectItem>
                {Array.from(new Set(aggregatableFields.flatMap((f) => f.aggregations ?? []))).map((aggregation) => (
                  <SelectItem key={aggregation} value={aggregation}>
                    {tAggregation(aggregation)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {config.aggregation !== "count" && valueFieldCandidates.length > 0 ? (
              <Select items={valueFieldLabels} value={config.valueField ?? ""} onValueChange={(v) => v && onChange({ ...config, valueField: v })}>
                <SelectTrigger className="h-8 w-40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {valueFieldCandidates.map((field) => (
                    <SelectItem key={field.key} value={field.key}>
                      {tFields(field.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
