"use client"

import { useTranslations } from "next-intl"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DATA_SOURCE_LABEL_KEYS } from "@/lib/reports/data-source-labels"
import { ALL_DATA_SOURCE_KEYS, isDataSourceAvailable, type ReportDataSourceKey } from "@/types/reports"

interface ReportDataSourceSelectProps {
  value: ReportDataSourceKey
  onChange: (value: ReportDataSourceKey) => void
}

/**
 * PAYROLL is filtered out of this list entirely outside local development
 * (isDataSourceAvailable), not merely disabled — the same function guards
 * the server-side fetch and validation, so this list and what the server
 * will actually run can never disagree.
 */
export function ReportDataSourceSelect({ value, onChange }: ReportDataSourceSelectProps) {
  const t = useTranslations("Reports.builder")
  const availableSources = ALL_DATA_SOURCE_KEYS.filter(isDataSourceAvailable)
  // Base UI's <Select.Value> only resolves the TRIGGER's displayed text
  // from this explicit value->label map — it never reads it back off the
  // mounted <SelectItem> children, so without this the trigger shows the
  // raw value ("EMPLOYEES") instead of the translated label.
  const itemLabels = Object.fromEntries(availableSources.map((source) => [source, t(DATA_SOURCE_LABEL_KEYS[source])]))

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {t("dataSourceLabel")}
      </Label>
      <Select items={itemLabels} value={value} onValueChange={(next) => next && onChange(next as ReportDataSourceKey)}>
        <SelectTrigger className="h-8 w-full text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableSources.map((source) => (
            <SelectItem key={source} value={source}>
              {t(DATA_SOURCE_LABEL_KEYS[source])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
