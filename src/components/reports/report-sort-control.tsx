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
import { EMPLOYEE_REPORT_FIELDS } from "@/lib/reports/field-registry"

const NONE_VALUE = "__none__"

interface ReportSortControlProps {
  sortBy: string | null
  sortDirection: "asc" | "desc"
  onChange: (sortBy: string | null, sortDirection: "asc" | "desc") => void
}

export function ReportSortControl({ sortBy, sortDirection, onChange }: ReportSortControlProps) {
  const t = useTranslations("Reports.builder")
  const tFields = useTranslations("Reports.fields")

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("sortTitle")}</Label>
      <div className="flex items-center gap-2">
        <Select
          value={sortBy ?? NONE_VALUE}
          onValueChange={(value) => onChange(value === NONE_VALUE ? null : value, sortDirection)}
        >
          <SelectTrigger className="h-8 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>{t("sortNone")}</SelectItem>
            {EMPLOYEE_REPORT_FIELDS.map((field) => (
              <SelectItem key={field.key} value={field.key}>
                {tFields(field.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sortDirection}
          onValueChange={(value) => onChange(sortBy, value as "asc" | "desc")}
        >
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
