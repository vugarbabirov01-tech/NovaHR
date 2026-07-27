"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { exportEmployeesAction } from "@/app/[locale]/(app)/employees/export/actions"
import type { ExportFormat, ExportScope, ExportType } from "@/lib/employee-export/types"

interface ExportEmployeesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allIds: string[]
  filteredIds: string[]
  selectedIds: string[]
}

function downloadBase64(base64: string, fileName: string, format: ExportFormat) {
  const mimeType =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv;charset=utf-8"
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function ExportEmployeesDialog({
  open,
  onOpenChange,
  allIds,
  filteredIds,
  selectedIds,
}: ExportEmployeesDialogProps) {
  const t = useTranslations("Employees.export")
  const [format, setFormat] = useState<ExportFormat>("xlsx")
  const [scope, setScope] = useState<ExportScope>(filteredIds.length !== allIds.length ? "filtered" : "all")

  // The dialog stays mounted (just hidden) between opens, so scope's
  // initial useState value only ever reflects whatever filter was active
  // the very first time it rendered — re-derive it fresh every time the
  // dialog actually opens instead.
  useEffect(() => {
    if (!open) return
    if (selectedIds.length > 0) {
      setScope("selected")
    } else if (filteredIds.length !== allIds.length) {
      setScope("filtered")
    } else {
      setScope("all")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const [exportType, setExportType] = useState<ExportType>("importTemplate")
  const [isExporting, setIsExporting] = useState(false)

  const scopeIds: Record<ExportScope, string[]> = {
    all: allIds,
    filtered: filteredIds,
    selected: selectedIds,
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      const ids = scopeIds[scope]
      const { base64, fileName } = await exportEmployeesAction(ids, format, exportType)
      downloadBase64(base64, fileName, format)
      onOpenChange(false)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t("scopeLabel")}</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as ExportScope)}>
              <Label className="flex items-center gap-2 text-sm font-normal">
                <RadioGroupItem value="all" />
                {t("scopeAll", { count: allIds.length })}
              </Label>
              <Label className="flex items-center gap-2 text-sm font-normal">
                <RadioGroupItem value="filtered" />
                {t("scopeFiltered", { count: filteredIds.length })}
              </Label>
              <Label
                className="flex items-center gap-2 text-sm font-normal data-disabled:opacity-50"
                data-disabled={selectedIds.length === 0 || undefined}
              >
                <RadioGroupItem value="selected" disabled={selectedIds.length === 0} />
                {t("scopeSelected", { count: selectedIds.length })}
              </Label>
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("formatLabel")}</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <Label className="flex items-center gap-2 text-sm font-normal">
                <RadioGroupItem value="xlsx" />
                {t("formatExcel")}
              </Label>
              <Label className="flex items-center gap-2 text-sm font-normal">
                <RadioGroupItem value="csv" />
                {t("formatCsv")}
              </Label>
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("typeLabel")}</Label>
            <RadioGroup value={exportType} onValueChange={(v) => setExportType(v as ExportType)}>
              <Label className="flex flex-col gap-0.5 text-sm font-normal">
                <span className="flex items-center gap-2">
                  <RadioGroupItem value="importTemplate" />
                  {t("typeImportTemplate")}
                </span>
                <span className="pl-6 text-xs text-muted-foreground">{t("typeImportTemplateHint")}</span>
              </Label>
              <Label className="flex flex-col gap-0.5 text-sm font-normal">
                <span className="flex items-center gap-2">
                  <RadioGroupItem value="fullReport" />
                  {t("typeFullReport")}
                </span>
                <span className="pl-6 text-xs text-muted-foreground">{t("typeFullReportHint")}</span>
              </Label>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isExporting} />}>{t("cancel")}</DialogClose>
          <Button onClick={handleExport} disabled={isExporting || scopeIds[scope].length === 0}>
            {isExporting ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {t("exportButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
