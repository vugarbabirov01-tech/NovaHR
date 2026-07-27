"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronRight, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IMPORTABLE_FIELD_ORDER } from "@/lib/employee-import/column-mapping"
import type { ColumnMapping, ImportableField, RawImportRow } from "@/lib/employee-import/types"

interface MapColumnsStepProps {
  headerColumns: string[]
  sampleRow?: RawImportRow
  columnMapping: ColumnMapping[]
  onConfirm: (mapping: ColumnMapping[]) => void
  onSaveDraft: () => void
  onBack: () => void
}

export function MapColumnsStep({
  headerColumns,
  sampleRow,
  columnMapping,
  onConfirm,
  onSaveDraft,
  onBack,
}: MapColumnsStepProps) {
  const t = useTranslations("Employees.import.mapping")
  const tFields = useTranslations("Employees.import.fields")
  const [mapping, setMapping] = useState<ColumnMapping[]>(columnMapping)

  // columnMapping arrives from the parent asynchronously (the worker has to
  // parse the sheet first), so the auto-suggested mapping is very often not
  // there yet at mount time — re-sync once it lands. This never re-fires
  // after that, since the parent only sets columnMapping again on confirm.
  useEffect(() => {
    if (columnMapping.length > 0) setMapping(columnMapping)
  }, [columnMapping])

  function setField(excelColumn: string, field: ImportableField | "ignore") {
    setMapping((prev) => prev.map((m) => (m.excelColumn === excelColumn ? { ...m, field } : m)))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-base font-semibold text-foreground">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs font-medium text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2.5 text-left">{t("columnDetected")}</th>
              <th className="px-4 py-2.5 text-left">{t("columnSample")}</th>
              <th className="px-4 py-2.5 text-left">{t("columnMapsTo")}</th>
            </tr>
          </thead>
          <tbody>
            {headerColumns.map((column) => {
              const current = mapping.find((m) => m.excelColumn === column)?.field ?? "ignore"
              return (
                <tr key={column} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium text-foreground">{column}</td>
                  <td className="px-4 py-2.5 truncate text-muted-foreground">
                    {String(sampleRow?.cells[column] ?? "")}
                  </td>
                  <td className="px-4 py-2.5">
                    <Select value={current} onValueChange={(value) => setField(column, value as ImportableField | "ignore")}>
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ignore">{t("ignoreColumn")}</SelectItem>
                        {IMPORTABLE_FIELD_ORDER.map((field) => (
                          <SelectItem key={field} value={field}>
                            {tFields(field)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          {t("back")}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onSaveDraft}>
            <Save className="size-4" strokeWidth={1.75} />
            {t("saveDraft")}
          </Button>
          <Button onClick={() => onConfirm(mapping)}>
            {t("next")}
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>
    </div>
  )
}
