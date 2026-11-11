"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAggregatableFieldsForDataSource, getReportFieldDefinition } from "@/lib/reports/field-registry"
import type { AnalyticsAggregation, AnalyticsSpec, ReportDataSourceKey } from "@/types/reports"

interface ReportKpiPickerProps {
  dataSource: ReportDataSourceKey
  kpis: AnalyticsSpec[]
  onChange: (kpis: AnalyticsSpec[]) => void
}

/**
 * Left-panel CONFIG half of KPIs — add/remove which extra KPIs (beyond the
 * always-on row count) this report shows. Renders no values at all (see
 * report-kpi-cards.tsx for that). The field/aggregation picker only ever
 * offers fields this data source's own registry marks aggregatable (see
 * field-registry.ts) — e.g. PAYROLL (no aggregatable field today) simply
 * renders nothing here, with no PAYROLL-specific code.
 */
export function ReportKpiPicker({ dataSource, kpis, onChange }: ReportKpiPickerProps) {
  const t = useTranslations("Reports.builder")
  const tAggregation = useTranslations("Reports.builder.aggregation")
  const tFields = useTranslations("Reports.fields")

  const aggregatableFields = getAggregatableFieldsForDataSource(dataSource)

  const [pendingField, setPendingField] = useState<string>(aggregatableFields[0]?.key ?? "")
  const allowedAggregationsForPending = aggregatableFields.find((f) => f.key === pendingField)?.aggregations ?? []
  const [pendingAggregation, setPendingAggregation] = useState<AnalyticsAggregation>(allowedAggregationsForPending[0] ?? "sum")

  if (aggregatableFields.length === 0) return null

  const fieldLabels: Record<string, string> = {}
  for (const field of aggregatableFields) fieldLabels[field.key] = tFields(field.labelKey)
  const aggregationLabels: Record<string, string> = {}
  for (const aggregation of allowedAggregationsForPending) aggregationLabels[aggregation] = tAggregation(aggregation)

  function handleFieldChange(fieldKey: string) {
    setPendingField(fieldKey)
    const allowed = aggregatableFields.find((f) => f.key === fieldKey)?.aggregations ?? []
    if (allowed.length > 0) setPendingAggregation(allowed[0])
  }

  // 2026-11-11 (requirement 6): the exact same (field, aggregation) pair
  // can't be added twice — e.g. "Orta — Yaş" showing up as two identical
  // chips would be confusing, not a second meaningful statistic.
  const isPendingDuplicate = kpis.some((spec) => spec.valueField === pendingField && spec.aggregation === pendingAggregation)

  function addKpi() {
    if (!pendingField || kpis.length >= 8 || isPendingDuplicate) return
    onChange([...kpis, { aggregation: pendingAggregation, valueField: pendingField }])
  }

  function removeKpi(index: number) {
    onChange(kpis.filter((_, i) => i !== index))
  }

  function labelFor(spec: AnalyticsSpec): string {
    const fieldDef = spec.valueField ? getReportFieldDefinition(spec.valueField) : undefined
    const fieldLabel = fieldDef ? tFields(fieldDef.labelKey) : (spec.valueField ?? "")
    return `${tAggregation(spec.aggregation)} — ${fieldLabel}`
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("kpiParametersTitle")}</Label>
      {kpis.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {kpis.map((spec, index) => (
            <span key={index} className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
              {labelFor(spec)}
              <button
                type="button"
                aria-label={t("removeKpi")}
                onClick={() => removeKpi(index)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3" strokeWidth={1.75} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {kpis.length < 8 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select items={fieldLabels} value={pendingField} onValueChange={(value) => value && handleFieldChange(value)}>
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {aggregatableFields.map((field) => (
                <SelectItem key={field.key} value={field.key}>
                  {tFields(field.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select items={aggregationLabels} value={pendingAggregation} onValueChange={(value) => value && setPendingAggregation(value as AnalyticsAggregation)}>
            <SelectTrigger className="h-8 w-28 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedAggregationsForPending.map((aggregation) => (
                <SelectItem key={aggregation} value={aggregation}>
                  {tAggregation(aggregation)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={addKpi} disabled={isPendingDuplicate}>
            <Plus className="size-3.5" strokeWidth={1.75} />
            {t("addKpi")}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
