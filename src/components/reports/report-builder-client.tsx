"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { ArrowLeft, Download, Loader2, Save } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/toast"
import { ReportColumnPicker } from "@/components/reports/report-column-picker"
import { ReportFilterPanel } from "@/components/reports/report-filter-panel"
import { ReportSortControl } from "@/components/reports/report-sort-control"
import { ReportPreviewTable } from "@/components/reports/report-preview-table"
import { SaveReportDialog } from "@/components/reports/save-report-dialog"
import {
  createReportAction,
  exportReportAction,
  previewReportAction,
  updateReportAction,
} from "@/app/[locale]/(app)/reports/actions"
import type { ReportFilter, ReportRow } from "@/types/reports"

const PAGE_SIZE = 25

function downloadBase64(base64: string, fileName: string) {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export interface ReportBuilderInitialReport {
  id: string
  name: string
  description: string
  columns: string[]
  filters: ReportFilter[]
  sortBy: string | null
  sortDirection: "asc" | "desc"
}

interface ReportBuilderClientProps {
  locale: string
  initialReport?: ReportBuilderInitialReport
}

/**
 * Orchestrates the whole builder screen: column/filter/sort state on the
 * left and top, a debounced live preview in the center, Save and Export
 * on the right. Always re-runs previewReportAction against the live
 * Employee table on every change — never shows a cached/stale result,
 * same guarantee the saved ReportDefinition itself makes (see that
 * model's schema comment).
 */
export function ReportBuilderClient({ locale, initialReport }: ReportBuilderClientProps) {
  const t = useTranslations("Reports.builder")
  const router = useRouter()
  const mode = initialReport ? "edit" : "create"

  const [name, setName] = useState(initialReport?.name ?? "")
  const [description, setDescription] = useState(initialReport?.description ?? "")
  const [columns, setColumns] = useState<string[]>(initialReport?.columns ?? [])
  const [filters, setFilters] = useState<ReportFilter[]>(initialReport?.filters ?? [])
  const [sortBy, setSortBy] = useState<string | null>(initialReport?.sortBy ?? null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(initialReport?.sortDirection ?? "asc")
  const [page, setPage] = useState(1)

  const [previewRows, setPreviewRows] = useState<ReportRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Any change to columns/filters/sort invalidates the current page — jump
  // back to page 1 rather than risk requesting a now out-of-range page.
  useEffect(() => {
    setPage(1)
  }, [columns, filters, sortBy, sortDirection])

  const latestRequestId = useRef(0)

  useEffect(() => {
    if (columns.length === 0) {
      setPreviewRows([])
      setTotalCount(0)
      return
    }
    const requestId = ++latestRequestId.current
    setIsLoadingPreview(true)
    const timeout = setTimeout(() => {
      previewReportAction({
        dataSource: "EMPLOYEES",
        columns,
        filters,
        sortBy,
        sortDirection,
        page,
        pageSize: PAGE_SIZE,
      }).then((result) => {
        if (requestId !== latestRequestId.current) return
        setIsLoadingPreview(false)
        if (result.success && result.data) {
          setPreviewRows(result.data.rows)
          setTotalCount(result.data.totalCount)
        }
      })
    }, 300)
    return () => clearTimeout(timeout)
  }, [columns, filters, sortBy, sortDirection, page])

  function handleSortChange(nextSortBy: string | null, nextDirection: "asc" | "desc") {
    setSortBy(nextSortBy)
    setSortDirection(nextDirection)
  }

  async function handleSaveConfirm(confirmedName: string, confirmedDescription: string) {
    setIsSaving(true)
    setSaveError(null)
    const input = {
      name: confirmedName,
      description: confirmedDescription || null,
      dataSource: "EMPLOYEES" as const,
      columns,
      filters,
      sortBy,
      sortDirection,
    }
    const result = mode === "create" ? await createReportAction(input) : await updateReportAction(initialReport!.id, input)
    setIsSaving(false)
    if (!result.success || !result.data) {
      setSaveError(result.error ?? t("saveError"))
      return
    }
    setName(confirmedName)
    setDescription(confirmedDescription)
    setSaveDialogOpen(false)
    toast.success(t("saveSuccess"))
    if (mode === "create") {
      router.push(`/reports/builder/${result.data.id}`)
    }
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      const result = await exportReportAction(
        { dataSource: "EMPLOYEES", columns, filters, sortBy, sortDirection },
        locale,
        name || "report"
      )
      if (result.success && result.data) {
        downloadBase64(result.data.base64, result.data.fileName)
      } else {
        toast.error(result.error ?? t("exportError"))
      }
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <Link
            href="/reports"
            className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.75} />
            {t("backToReports")}
          </Link>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            {mode === "create" ? t("newTitle") : t("editTitle")}
          </h1>
          {name ? <p className="text-sm text-muted-foreground">{name}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" onClick={handleExport} disabled={isExporting || columns.length === 0}>
            {isExporting ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : <Download className="size-4" strokeWidth={1.75} />}
            {t("exportButton")}
          </Button>
          <Button type="button" onClick={() => setSaveDialogOpen(true)} disabled={columns.length === 0}>
            <Save className="size-4" strokeWidth={1.75} />
            {mode === "create" ? t("saveButton") : t("updateButton")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-6">
          <ReportColumnPicker selectedColumns={columns} onChange={setColumns} />
          <Separator />
          <ReportSortControl sortBy={sortBy} sortDirection={sortDirection} onChange={handleSortChange} />
        </div>

        <div className="flex flex-col gap-6">
          <ReportFilterPanel filters={filters} onChange={setFilters} />
          <Separator />
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("previewTitle")}</h2>
            <ReportPreviewTable
              columns={columns}
              rows={previewRows}
              totalCount={totalCount}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              isLoading={isLoadingPreview}
            />
          </div>
        </div>
      </div>

      <SaveReportDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        mode={mode}
        initialName={name}
        initialDescription={description}
        isSaving={isSaving}
        error={saveError}
        onConfirm={handleSaveConfirm}
      />
    </div>
  )
}
