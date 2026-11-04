"use client"

import { useTranslations } from "next-intl"
import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EMPLOYEE_REPORT_FIELDS,
  getEnumMessagePath,
  getReportFieldDefinition,
} from "@/lib/reports/field-registry"
import { OPERATORS_BY_FIELD_TYPE, VALUELESS_OPERATORS, type FilterOperator, type ReportFilter } from "@/types/reports"

interface ReportFilterPanelProps {
  filters: ReportFilter[]
  onChange: (filters: ReportFilter[]) => void
}

const DEFAULT_FIELD = EMPLOYEE_REPORT_FIELDS[0].key

function defaultOperatorFor(fieldKey: string): FilterOperator {
  const definition = getReportFieldDefinition(fieldKey)
  return definition ? OPERATORS_BY_FIELD_TYPE[definition.type][0] : "equals"
}

/**
 * Phase 1's "simple filters": a flat list, combined with AND only (nested
 * AND/OR groups are a later phase, per the approved Phase 1 scope). Each
 * row's operator choices and value input are driven entirely by that
 * field's type from the registry, so a date field never offers "contains"
 * and a string field never offers "between".
 */
export function ReportFilterPanel({ filters, onChange }: ReportFilterPanelProps) {
  const t = useTranslations("Reports.builder")
  const tFields = useTranslations("Reports.fields")
  const tOperators = useTranslations("Reports.operators")
  const tEnum = useTranslations()

  function addFilter() {
    onChange([...filters, { field: DEFAULT_FIELD, operator: defaultOperatorFor(DEFAULT_FIELD), value: "" }])
  }

  function updateFilter(index: number, patch: Partial<ReportFilter>) {
    onChange(filters.map((filter, i) => (i === index ? { ...filter, ...patch } : filter)))
  }

  function removeFilter(index: number) {
    onChange(filters.filter((_, i) => i !== index))
  }

  function handleFieldChange(index: number, fieldKey: string) {
    updateFilter(index, { field: fieldKey, operator: defaultOperatorFor(fieldKey), value: "", valueTo: undefined })
  }

  function renderValueInput(filter: ReportFilter, index: number) {
    if (VALUELESS_OPERATORS.includes(filter.operator)) return null
    const definition = getReportFieldDefinition(filter.field)
    if (!definition) return null

    if (definition.type === "enum") {
      return (
        <Select
          value={filter.value ? String(filter.value) : ""}
          onValueChange={(value) => updateFilter(index, { value })}
        >
          <SelectTrigger className="h-8 w-full text-sm">
            <SelectValue placeholder={t("valueLabel")} />
          </SelectTrigger>
          <SelectContent>
            {(definition.enumValues ?? []).map((value) => {
              const messagePath = getEnumMessagePath(definition, value)
              return (
                <SelectItem key={value} value={value}>
                  {messagePath ? tEnum(messagePath) : value}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      )
    }

    const inputType = definition.type === "number" ? "number" : definition.type === "date" ? "date" : "text"

    if (filter.operator === "between") {
      return (
        <div className="flex items-center gap-1.5">
          <Input
            type={inputType}
            value={filter.value ?? ""}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            className="h-8 text-sm"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <Input
            type={inputType}
            value={filter.valueTo ?? ""}
            onChange={(e) => updateFilter(index, { valueTo: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      )
    }

    return (
      <Input
        type={inputType}
        value={filter.value ?? ""}
        onChange={(e) => updateFilter(index, { value: e.target.value })}
        className="h-8 text-sm"
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("filtersTitle")}
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addFilter}>
          <Plus className="size-3.5" strokeWidth={1.75} />
          {t("addFilter")}
        </Button>
      </div>

      {filters.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noFilters")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filters.map((filter, index) => {
            const definition = getReportFieldDefinition(filter.field)
            const operators = definition ? OPERATORS_BY_FIELD_TYPE[definition.type] : []
            return (
              <div key={index} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-start sm:gap-2">
                <div className="grid flex-1 gap-2 sm:grid-cols-3">
                  <Select value={filter.field} onValueChange={(value) => value && handleFieldChange(index, value)}>
                    <SelectTrigger className="h-8 w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_REPORT_FIELDS.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                          {tFields(field.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filter.operator}
                    onValueChange={(value) => updateFilter(index, { operator: value as FilterOperator, value: "", valueTo: undefined })}
                  >
                    <SelectTrigger className="h-8 w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((operator) => (
                        <SelectItem key={operator} value={operator}>
                          {tOperators(operator)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {renderValueInput(filter, index)}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("removeFilter")}
                  onClick={() => removeFilter(index)}
                >
                  <X className="size-3.5" strokeWidth={1.75} />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
