"use client"

import { useFormatter, useTranslations } from "next-intl"
import { Hash } from "lucide-react"

import { Label } from "@/components/ui/label"
import { KpiCard } from "@/components/common/kpi-card"
import { buildAnalyticsValueFormatters, formatAnalyticsValue } from "@/lib/reports/analytics-format"
import { getReportFieldDefinition } from "@/lib/reports/field-registry"
import type { AnalyticsResult, AnalyticsSpec } from "@/types/reports"

interface ReportKpiCardsProps {
  kpis: AnalyticsSpec[]
  results: AnalyticsResult[]
  isLoading: boolean
}

/**
 * Pure DISPLAY half of KPIs — index 0 of `results` is always the implicit,
 * always-on row-count KPI (see report-execution-service.ts); results[1..]
 * line up 1:1 with the `kpis` prop by array order (see
 * report-kpi-picker.tsx for the half that writes `kpis`). Every value goes
 * through formatAnalyticsValue, the same formatter report-chart-display
 * and report-export.ts use, so a duration-flagged field (e.g. average
 * tenure) reads as "X il Y ay" here too — the 2026-11-11 fix for the "73"
 * bug — instead of a bare, unit-less Math.round().
 */
export function ReportKpiCards({ kpis, results, isLoading }: ReportKpiCardsProps) {
  const t = useTranslations("Reports.builder")
  const tAggregation = useTranslations("Reports.builder.aggregation")
  const tFields = useTranslations("Reports.fields")
  const format = useFormatter()
  const formatters = buildAnalyticsValueFormatters(tFields, format.number)

  function labelFor(spec: AnalyticsSpec): string {
    const fieldDef = spec.valueField ? getReportFieldDefinition(spec.valueField) : undefined
    const fieldLabel = fieldDef ? tFields(fieldDef.labelKey) : (spec.valueField ?? "")
    return `${tAggregation(spec.aggregation)} — ${fieldLabel}`
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("kpiCardsTitle")}</Label>
      <div className="flex flex-wrap items-stretch gap-3">
        {results.map((result, index) => {
          const spec: Pick<AnalyticsSpec, "aggregation" | "valueField"> = index === 0 ? { aggregation: "count" } : kpis[index - 1]
          const value = isLoading ? "…" : formatAnalyticsValue(result.points[0]?.value ?? 0, spec, formatters)
          return (
            <KpiCard
              key={index}
              className="min-w-[160px] flex-1 basis-[160px]"
              icon={Hash}
              label={index === 0 ? t("rowCountLabel") : labelFor(kpis[index - 1])}
              value={value}
            />
          )
        })}
      </div>
    </div>
  )
}
