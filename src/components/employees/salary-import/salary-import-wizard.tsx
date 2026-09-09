"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import * as XLSX from "xlsx"
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Loader2, RotateCcw } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DataTable } from "@/components/common/data-table"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Stepper } from "@/components/common/stepper"
import { toast } from "@/components/ui/toast"
import { extractSheetRows, parseWorkbook } from "@/lib/employee-import/file-parser"
import { detectSalaryColumns, parseSalaryRows, type ParsedSalaryRow } from "@/lib/salary-import/row-parser"
import { formatAzn } from "@/lib/salary-import/apply-salary-update"
import {
  commitSalaryImportAction,
  previewSalaryImportAction,
  type SalaryImportInputRow,
} from "@/app/[locale]/(app)/employees/salary-import/actions"
import type { SalaryImportCommitResult, SalaryImportPreviewRow } from "@/lib/salary-import/types"

const PAGE_SIZE = 50

type Phase = "upload" | "preview" | "result"

type StatusFilter = "all" | "error" | "not-found"

function toInputRows(rows: ParsedSalaryRow[]): SalaryImportInputRow[] {
  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    finCode: row.finCode,
    salary: row.salary,
    effectiveDate: row.effectiveDate,
    parseError: row.parseError,
  }))
}

function statusBadgeVariant(status: SalaryImportPreviewRow["status"]) {
  if (status === "error" || status === "not-found") return "destructive" as const
  if (status === "no-change") return "secondary" as const
  return "default" as const
}

/** Same 3 headers detectSalaryColumns/suggestFieldForColumn already
 * recognize (see EXTRA_ALIASES in column-mapping.ts) — a blank template
 * built from anything else would defeat its own purpose. */
function downloadTemplate() {
  const sheetRows = [
    { "FİN": "AA12345", "Əmək haqqı": 700, "Qüvvəyə minmə tarixi": "01.09.2026" },
    { "FİN": "BB45678", "Əmək haqqı": 850, "Qüvvəyə minmə tarixi": "01.09.2026" },
    { "FİN": "CC78901", "Əmək haqqı": 1200, "Qüvvəyə minmə tarixi": "01.09.2026" },
  ]
  const worksheet = XLSX.utils.json_to_sheet(sheetRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Əmək Haqqı")
  XLSX.writeFile(workbook, "emek-haqqi-idxal-sablonu.xlsx")
}

function downloadFailedRows(rows: SalaryImportPreviewRow[]) {
  const sheetRows = rows.map((row) => ({
    Sətir: row.rowNumber,
    FIN: row.finCode,
    Status: row.message,
  }))
  const worksheet = XLSX.utils.json_to_sheet(sheetRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Xətalar")
  XLSX.writeFile(workbook, "emek-haqqi-idxal-xetalari.xlsx")
}

export function SalaryImportWizard() {
  const t = useTranslations("Employees.salaryImport")

  const [phase, setPhase] = useState<Phase>("upload")
  const [fileName, setFileName] = useState("")
  const [parsedRows, setParsedRows] = useState<ParsedSalaryRow[]>([])
  const [previewRows, setPreviewRows] = useState<SalaryImportPreviewRow[]>([])
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SalaryImportCommitResult | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const steps = [
    { key: "upload", label: t("steps.upload") },
    { key: "preview", label: t("steps.preview") },
    { key: "result", label: t("steps.result") },
  ]
  const currentStepIndex = phase === "upload" ? 0 : phase === "preview" ? 1 : 2

  const summary = useMemo(() => {
    return {
      totalRows: previewRows.length,
      matched: previewRows.filter((r) => r.status === "ready" || r.status === "will-update" || r.status === "no-change")
        .length,
      notFound: previewRows.filter((r) => r.status === "not-found").length,
      errors: previewRows.filter((r) => r.status === "error").length,
    }
  }, [previewRows])

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return previewRows
    if (statusFilter === "error") return previewRows.filter((r) => r.status === "error")
    return previewRows.filter((r) => r.status === "not-found")
  }, [previewRows, statusFilter])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const currentPage = Math.min(pageIndex, pageCount - 1)
  const pageRows = filteredRows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  async function handleFile(file: File) {
    setError(null)
    setFileName(file.name)
    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv")
      const data = isCsv ? await file.text() : await file.arrayBuffer()
      const { workbook, sheetNames } = parseWorkbook(file.name, data)
      const firstSheet = sheetNames[0]
      if (!firstSheet) {
        setError(t("errors.emptyFile"))
        return
      }

      const { headerColumns, rows } = extractSheetRows(workbook, firstSheet)
      const columns = detectSalaryColumns(headerColumns)
      if (!columns.finColumn || !columns.salaryColumn) {
        setError(t("errors.columnsNotDetected"))
        return
      }

      const parsed = parseSalaryRows(rows, columns)
      setParsedRows(parsed)
      setPhase("preview")
      setPageIndex(0)
      setStatusFilter("all")
      setIsLoadingPreview(true)
      const preview = await previewSalaryImportAction(toInputRows(parsed))
      setPreviewRows(preview.rows)
    } catch {
      setError(t("errors.parseFailed"))
    } finally {
      setIsLoadingPreview(false)
    }
  }

  async function handleConfirmImport() {
    setIsImporting(true)
    try {
      const commitResult = await commitSalaryImportAction(toInputRows(parsedRows))
      setResult(commitResult)
      setPhase("result")
      toast.success(t("resultToastTitle"), t("resultToastDescription", { count: commitResult.summary.updated }))
    } finally {
      setIsImporting(false)
    }
  }

  function handleReset() {
    setPhase("upload")
    setFileName("")
    setParsedRows([])
    setPreviewRows([])
    setResult(null)
    setError(null)
    setPageIndex(0)
    setStatusFilter("all")
  }

  const columns: ColumnDef<SalaryImportPreviewRow>[] = [
    { accessorKey: "finCode", header: t("columnFin") },
    {
      id: "employee",
      header: t("columnEmployee"),
      cell: ({ row }) => row.original.employeeName ?? "—",
    },
    {
      id: "currentSalary",
      header: t("columnCurrentSalary"),
      cell: ({ row }) => (row.original.currentSalary ? formatAzn(row.original.currentSalary) : "—"),
    },
    {
      id: "newSalary",
      header: t("columnNewSalary"),
      cell: ({ row }) => (row.original.newSalary !== undefined ? formatAzn(row.original.newSalary) : "—"),
    },
    {
      id: "status",
      header: t("columnStatus"),
      cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.message}</Badge>,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <Stepper steps={steps} currentIndex={currentStepIndex} />

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {phase === "upload" ? (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="size-3.5" strokeWidth={1.75} />
              {t("upload.downloadTemplate")}
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <FileDropzone
                label={t("upload.dropzoneLabel")}
                hint={t("upload.dropzoneHint")}
                accept=".xlsx,.csv"
                onFiles={(files) => {
                  const file = files[0]
                  if (file) handleFile(file)
                }}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {phase === "preview" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{fileName}</p>

          {isLoadingPreview ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
              {t("preview.loading")}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card>
                  <CardContent className="flex flex-col gap-1 pt-6">
                    <span className="text-2xl font-semibold text-foreground">{summary.totalRows}</span>
                    <span className="text-xs text-muted-foreground">{t("preview.totalRows")}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-1 pt-6">
                    <span className="text-2xl font-semibold text-foreground">{summary.matched}</span>
                    <span className="text-xs text-muted-foreground">{t("preview.matched")}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-1 pt-6">
                    <span className="text-2xl font-semibold text-destructive">{summary.notFound}</span>
                    <span className="text-xs text-muted-foreground">{t("preview.notFound")}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-1 pt-6">
                    <span className="text-2xl font-semibold text-destructive">{summary.errors}</span>
                    <span className="text-xs text-muted-foreground">{t("preview.errors")}</span>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={statusFilter === "all" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setStatusFilter("all")
                    setPageIndex(0)
                  }}
                >
                  {t("preview.filterAll", { count: previewRows.length })}
                </Button>
                <Button
                  variant={statusFilter === "not-found" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setStatusFilter("not-found")
                    setPageIndex(0)
                  }}
                >
                  {t("preview.filterNotFound", { count: summary.notFound })}
                </Button>
                <Button
                  variant={statusFilter === "error" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setStatusFilter("error")
                    setPageIndex(0)
                  }}
                >
                  {t("preview.filterErrors", { count: summary.errors })}
                </Button>
              </div>

              <DataTable
                columns={columns}
                data={pageRows}
                emptyTitle={t("preview.emptyTitle")}
                emptyDescription={t("preview.emptyDescription")}
              />

              {filteredRows.length > PAGE_SIZE ? (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{t("preview.pageIndicator", { current: currentPage + 1, total: pageCount })}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={currentPage === 0}
                      onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="size-4" strokeWidth={1.75} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={currentPage >= pageCount - 1}
                      onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                    >
                      <ChevronRight className="size-4" strokeWidth={1.75} />
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between border-t border-border pt-4">
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="size-3.5" strokeWidth={1.75} />
                  {t("preview.startOver")}
                </Button>
                <Button onClick={handleConfirmImport} disabled={isImporting || summary.matched === 0}>
                  {isImporting ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
                  {t("preview.confirmButton")}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {phase === "result" && result ? (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-2 pt-6 text-sm">
              <p className="text-foreground">{t("result.updated", { count: result.summary.updated })}</p>
              {result.summary.notFound > 0 ? (
                <p className="text-muted-foreground">{t("result.notFound", { count: result.summary.notFound })}</p>
              ) : null}
              {result.summary.errors > 0 ? (
                <p className="text-muted-foreground">{t("result.errors", { count: result.summary.errors })}</p>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            {result.failedRows.length > 0 ? (
              <Button variant="outline" onClick={() => downloadFailedRows(result.failedRows)}>
                <Download className="size-3.5" strokeWidth={1.75} />
                {t("result.downloadErrors")}
              </Button>
            ) : null}
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="size-3.5" strokeWidth={1.75} />
              {t("result.importAnother")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
