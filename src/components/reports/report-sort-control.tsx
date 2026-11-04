"use client"

import { useTranslations } from "next-intl"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getFieldsForDataSource } from "@/lib/reports/field-registry"
import type { ReportDataSourceKey } from "@/types/reports"

const NONE_VALUE = "__none__"

interface ReportSortControlProps {
  dataSource: ReportDataSourceKey
  sortBy: string | null
  sortDirection: "asc" | "desc"
  onChange: (sortBy: string | null, sortDirection: "asc" | "desc") => void
}

export function ReportSortControl({ dataSource, sortBy, sortDirection, onChange }: ReportSortControlProps) {
  const t = useTranslations("Reports.builder")
  const tFields = useTranslations("Reports.fields")
  const fieldsForSource = getFieldsForDataSource(dataSource)

  // See report-data-source-select.tsx's own comment — Base UI's
  // <Select.Value> needs an explicit value->label map to display the
  // trigger's current selection translated, it never reads it back off
  // the mounted <SelectItem> children.
  const sortByLabels: Record<string, string> = { [NONE_VALUE]: t("sortNone") }
  for (const field of fieldsForSource) sortByLabels[field.key] = tFields(field.labelKey)
  const directionLabels = { asc: t("sortAsc"), desc: t("sortDesc") }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("sortTitle")}</Label>
      <div className="flex items-center gap-2">
        <Select
          items={sortByLabels}
          value={sortBy ?? NONE_VALUE}
          onValueChange={(value) => onChange(value === NONE_VALUE ? null : value, sortDirection)}
        >
          <SelectTrigger className="h-8 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>{t("sortNone")}</SelectItem>
            {fieldsForSource.map((field) => (
              <SelectItem key={field.key} value={field.key}>
                {tFields(field.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select items={directionLabels} value={sortDirection} onValueChange={(value) => onChange(sortBy, value as "asc" | "desc")}>
          <SelectTrigger className="h-8 w-fit text-sm" disabled={!sortBy}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">{t("sortAsc")}</SelectItem>
            <SelectItem value="desc">{t("sortDesc")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
