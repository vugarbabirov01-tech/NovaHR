"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { ArrowLeft, Download, Loader2, Save } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/toast"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ReportDataSourceSelect } from "@/components/reports/report-data-source-select"
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
import type { ReportDataSourceKey, ReportFilter, ReportRow } from "@/types/reports"

const PAGE_SIZE = 25

/** These three sources match employees to org units by name only (Employee
 * has no companyId/departmentId/positionId — see field-registry.ts's own
 * comment); BRANCHES is deliberately excluded here since it matches by the
 * real branchId relation and needs no such caveat. */
const NAME_MATCHED_SOURCES: ReadonlySet<ReportDataSourceKey> = new Set(["COMPANIES", "DEPARTMENTS", "POSITIONS"])

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
  dataSource: ReportDataSourceKey
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
 * Orchestrates the whole builder screen: data source + column/filter/sort
 * state on the left and top, a debounced live preview in the center, Save
 * and Export on the right. Always re-runs previewReportAction against
 * live data on every change — never shows a cached/stale result, same
 * guarantee the saved ReportDefinition itself makes (see that model's
 * schema comment).
 */
export function ReportBuilderClient({ locale, initialReport }: ReportBuilderClientProps) {
  const t = useTranslations("Reports.builder")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const mode = initialReport ? "edit" : "create"

  const [name, setName] = useState(initialReport?.name ?? "")
  const [description, setDescription] = useState(initialReport?.description ?? "")
  const [dataSource, setDataSource] = useState<ReportDataSourceKey>(initialReport?.dataSource ?? "EMPLOYEES")
  const [columns, setColumns] = useState<string[]>(initialReport?.columns ?? [])
  const [filters, setFilters] = useState<ReportFilter[]>(initialReport?.filters ?? [])
  const [sortBy, setSortBy] = useState<string | null>(initialReport?.sortBy ?? null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(initialReport?.sortDirection ?? "asc")
  const [page, setPage] = useState(1)

  // Switching data source discards the current column/filter/sort
  // selection (a different source's fields are a different vocabulary) —
  // held here until the user confirms, so an accidental click never
  // silently loses work already done.
  const [pendingDataSource, setPendingDataSource] = useState<ReportDataSourceKey | null>(null)

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
  }, [dataSource, columns, filters, sortBy, sortDirection])

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
        dataSource,
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
  }, [dataSource, columns, filters, sortBy, sortDirection, page])

  function handleSortChange(nextSortBy: string | null, nextDirection: "asc" | "desc") {
    setSortBy(nextSortBy)
    setSortDirection(nextDirection)
  }

  function requestDataSourceChange(next: ReportDataSourceKey) {
    if (next === dataSource) return
    if (columns.length === 0 && filters.length === 0 && !sortBy) {
      setDataSource(next)
      return
    }
    setPendingDataSource(next)
  }

  function confirmDataSourceChange() {
    if (!pendingDataSource) return
    setDataSource(pendingDataSource)
    setColumns([])
    setFilters([])
    setSortBy(null)
    setSortDirection("asc")
    setPendingDataSource(null)
  }

  async function handleSaveConfirm(confirmedName: string, confirmedDescription: string) {
    setIsSaving(true)
    setSaveError(null)
    const input = {
      name: confirmedName,
      description: confirmedDescription || null,
      dataSource,
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
        { dataSource, columns, filters, sortBy, sortDirection },
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

  const showNameMatchingNotice = NAME_MATCHED_SOURCES.has(dataSource)
  const showPayrollNotice = dataSource === "PAYROLL"

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
          <ReportDataSourceSelect value={dataSource} onChange={requestDataSourceChange} />
          {showNameMatchingNotice ? (
            <p className="rounded-lg border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
              {t("organizationNameMatchingNotice")}
            </p>
          ) : null}
          {showPayrollNotice ? (
            <p className="rounded-lg border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
              {t("payrollDevOnlyNotice")}
            </p>
          ) : null}
          <ReportColumnPicker dataSource={dataSource} selectedColumns={columns} onChange={setColumns} />
          <Separator />
          <ReportSortControl dataSource={dataSource} sortBy={sortBy} sortDirection={sortDirection} onChange={handleSortChange} />
        </div>

        <div className="flex flex-col gap-6">
          <ReportFilterPanel dataSource={dataSource} filters={filters} onChange={setFilters} />
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

      <Dialog open={pendingDataSource !== null} onOpenChange={(open) => !open && setPendingDataSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("changeSourceConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("changeSourceConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{tCommon("cancel")}</DialogClose>
            <Button onClick={confirmDataSourceChange}>{t("changeSourceConfirmButton")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
