"use client"

import { useTranslations } from "next-intl"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { buildChartSpecForField } from "@/lib/reports/analytics-spec-defaults"
import { getAggregatableFieldsForDataSource, getGroupableFieldsForDataSource } from "@/lib/reports/field-registry"
import type { AnalyticsAggregation, AnalyticsSpec, ReportDataSourceKey } from "@/types/reports"

interface ReportComparisonPickerProps {
  dataSource: ReportDataSourceKey
  chartConfig: AnalyticsSpec | null
  onChange: (chartConfig: AnalyticsSpec | null) => void
}

/**
 * Simple mode's Q4 ("Nəyə görə müqayisə etmək istəyirəm?") — a lighter
 * editing surface over the EXACT SAME `chartConfig` the Pro-mode
 * ReportChartConfigPanel writes (via the same buildChartSpecForField
 * helper), so switching modes never loses or duplicates state. Never
 * exposes bucket kind, bucket count, or chart type here — those stay
 * under "Ətraflı tənzimləmələr" (report-chart-config-panel.tsx itself,
 * reused there verbatim) per the "don't show technical terms" requirement.
 */
export function ReportComparisonPicker({ dataSource, chartConfig, onChange }: ReportComparisonPickerProps) {
  const t = useTranslations("Reports.builder")
  const tAggregation = useTranslations("Reports.builder.aggregation")
  const tFields = useTranslations("Reports.fields")

  const groupableFields = getGroupableFieldsForDataSource(dataSource)
  const aggregatableFields = getAggregatableFieldsForDataSource(dataSource)
  if (groupableFields.length === 0) return null

  const groupByFieldLabels: Record<string, string> = {}
  for (const field of groupableFields) groupByFieldLabels[field.key] = tFields(field.labelKey)

  const aggregation = chartConfig?.aggregation ?? "count"
  const aggregationLabels: Record<string, string> = { count: t("chartAggregationCountLabel") }
  for (const field of aggregatableFields) {
    for (const agg of field.aggregations ?? []) aggregationLabels[agg] = tAggregation(agg)
  }
  const valueFieldCandidates = aggregatableFields.filter((f) => (f.aggregations ?? []).includes(aggregation as never))
  const valueFieldLabels: Record<string, string> = {}
  for (const field of valueFieldCandidates) valueFieldLabels[field.key] = tFields(field.labelKey)

  function handleFieldChange(fieldKey: string) {
    onChange(buildChartSpecForField(fieldKey, chartConfig))
  }

  function handleAggregationChange(nextAggregation: AnalyticsAggregation) {
    if (!chartConfig) return
    if (nextAggregation === "count") {
      onChange({ ...chartConfig, aggregation: nextAggregation, valueField: undefined })
      return
    }
    const candidates = aggregatableFields.filter((f) => (f.aggregations ?? []).includes(nextAggregation))
    const valueField = candidates.some((f) => f.key === chartConfig.valueField) ? chartConfig.valueField : candidates[0]?.key
    onChange({ ...chartConfig, aggregation: nextAggregation, valueField })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select items={groupByFieldLabels} value={chartConfig?.groupBy?.field ?? ""} onValueChange={(v) => v && handleFieldChange(v)}>
        <SelectTrigger className="h-9 w-48 text-sm">
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

      {chartConfig?.groupBy ? (
        <>
          <Select items={aggregationLabels} value={aggregation} onValueChange={(v) => v && handleAggregationChange(v as AnalyticsAggregation)}>
            <SelectTrigger className="h-9 w-32 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count">{t("chartAggregationCountLabel")}</SelectItem>
              {Array.from(new Set(aggregatableFields.flatMap((f) => f.aggregations ?? []))).map((agg) => (
                <SelectItem key={agg} value={agg}>
                  {tAggregation(agg)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {aggregation !== "count" && valueFieldCandidates.length > 0 ? (
            <Select items={valueFieldLabels} value={chartConfig.valueField ?? ""} onValueChange={(v) => v && onChange({ ...chartConfig, valueField: v })}>
              <SelectTrigger className="h-9 w-44 text-sm">
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

          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("chartClear")} onClick={() => onChange(null)}>
            <X className="size-3.5" strokeWidth={1.75} />
          </Button>
        </>
      ) : null}
    </div>
  )
}
