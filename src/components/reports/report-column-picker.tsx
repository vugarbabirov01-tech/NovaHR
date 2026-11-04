"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown, ChevronUp, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  EMPLOYEE_REPORT_FIELDS,
  type ReportFieldCategory,
} from "@/lib/reports/field-registry"

interface ReportColumnPickerProps {
  selectedColumns: string[]
  onChange: (columns: string[]) => void
}

const CATEGORIES: ReportFieldCategory[] = ["personal", "employment"]

/**
 * Left-hand half of the builder: a searchable, category-grouped checkbox
 * list of every reportable field, plus the ordered list of currently
 * selected columns (up/down + remove — no drag-and-drop library added for
 * Phase 1's reorder need, see the field-picker's own scope note in the
 * Phase 1 report). Toggling a checkbox appends to (or removes from) the
 * selection; order is controlled entirely by the second list.
 */
export function ReportColumnPicker({ selectedColumns, onChange }: ReportColumnPickerProps) {
  const t = useTranslations("Reports.builder")
  const tFields = useTranslations("Reports.fields")
  const [search, setSearch] = useState("")

  const selectedSet = useMemo(() => new Set(selectedColumns), [selectedColumns])

  const fieldsByCategory = useMemo(() => {
    const query = search.trim().toLowerCase()
    const grouped = new Map<ReportFieldCategory, typeof EMPLOYEE_REPORT_FIELDS>()
    for (const category of CATEGORIES) grouped.set(category, [])
    for (const field of EMPLOYEE_REPORT_FIELDS) {
      const label = tFields(field.labelKey)
      if (query && !label.toLowerCase().includes(query)) continue
      grouped.get(field.category)?.push(field)
    }
    return grouped
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function toggleField(key: string, checked: boolean) {
    if (checked) {
      if (!selectedSet.has(key)) onChange([...selectedColumns, key])
    } else {
      onChange(selectedColumns.filter((column) => column !== key))
    }
  }

  function moveColumn(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= selectedColumns.length) return
    const next = [...selectedColumns]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function removeColumn(key: string) {
    onChange(selectedColumns.filter((column) => column !== key))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("columnsTitle")}
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchFieldsPlaceholder")}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <ScrollArea className="h-56 rounded-lg border border-border">
          <div className="flex flex-col gap-3 p-3">
            {CATEGORIES.map((category) => {
              const fields = fieldsByCategory.get(category) ?? []
              if (fields.length === 0) return null
              return (
                <div key={category} className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t(category === "personal" ? "categoryPersonal" : "categoryEmployment")}
                  </span>
                  {fields.map((field) => (
                    <Label key={field.key} className="flex items-center gap-2 text-sm font-normal">
                      <Checkbox
                        checked={selectedSet.has(field.key)}
                        onCheckedChange={(checked) => toggleField(field.key, checked === true)}
                      />
                      {tFields(field.labelKey)}
                    </Label>
                  ))}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("selectedColumnsTitle")}
        </Label>
        {selectedColumns.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noColumnsSelected")}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {selectedColumns.map((key, index) => (
              <div
                key={key}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm"
                )}
              >
                <span className="truncate">{tFields(key)}</span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={index === 0}
                    aria-label={t("moveUp")}
                    onClick={() => moveColumn(index, -1)}
                  >
                    <ChevronUp className="size-3.5" strokeWidth={1.75} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={index === selectedColumns.length - 1}
                    aria-label={t("moveDown")}
                    onClick={() => moveColumn(index, 1)}
                  >
                    <ChevronDown className="size-3.5" strokeWidth={1.75} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("removeColumn")}
                    onClick={() => removeColumn(key)}
                  >
                    <X className="size-3.5" strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
