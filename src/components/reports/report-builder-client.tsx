"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { ArrowLeft, Download, Loader2, Plus, Save } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { ReportKpiPicker } from "@/components/reports/report-kpi-picker"
import { ReportKpiCards } from "@/components/reports/report-kpi-cards"
import { ReportChartConfigPanel } from "@/components/reports/report-chart-config-panel"
import { ReportChartDisplay } from "@/components/reports/report-chart-display"
import { ReportPreviewTable } from "@/components/reports/report-preview-table"
import { ReportSimpleMode } from "@/components/reports/report-simple-mode"
import { SaveReportDialog } from "@/components/reports/save-report-dialog"
import {
  createReportAction,
  exportReportAction,
  previewReportAction,
  updateReportAction,
} from "@/app/[locale]/(app)/reports/actions"
import { getReportFieldDefinition } from "@/lib/reports/field-registry"
import type { AnalyticsResult, AnalyticsSpec, ReportDataSourceKey, ReportFilter, ReportRow } from "@/types/reports"

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
  kpis: AnalyticsSpec[]
  chartConfig: AnalyticsSpec | null
}

interface ReportBuilderClientProps {
  locale: string
  initialReport?: ReportBuilderInitialReport
  /** Pre-fills a NEW report (e.g. from a ready-made template) — unlike
   * initialReport it has no id, so the builder stays in create mode and
   * saving makes the user their own copy. */
  prefill?: Omit<ReportBuilderInitialReport, "id">
}

/**
 * Orchestrates the whole builder screen: data source + column/filter/sort
 * state on the left and top, a debounced live preview in the center, Save
 * and Export on the right. Always re-runs previewReportAction against
 * live data on every change — never shows a cached/stale result, same
 * guarantee the saved ReportDefinition itself makes (see that model's
 * schema comment).
 */
export function ReportBuilderClient({ locale, initialReport, prefill }: ReportBuilderClientProps) {
  const t = useTranslations("Reports.builder")
  const tFields = useTranslations("Reports.fields")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const mode = initialReport ? "edit" : "create"
  const seed = initialReport ?? prefill
  // Simple vs. Pro — a VIEW over the same state below, never a separate
  // copy of it (point 3, 2026-11-11: switching never loses anything,
  // because there is nothing mode-specific to lose). Simple is the
  // default per that same decision.
  const [viewMode, setViewMode] = useState<"simple" | "pro">("simple")

  const [name, setName] = useState(seed?.name ?? "")
  const [description, setDescription] = useState(seed?.description ?? "")
  const [dataSource, setDataSource] = useState<ReportDataSourceKey>(seed?.dataSource ?? "EMPLOYEES")
  const [columns, setColumns] = useState<string[]>(seed?.columns ?? [])
  const [filters, setFilters] = useState<ReportFilter[]>(seed?.filters ?? [])
  const [sortBy, setSortBy] = useState<string | null>(seed?.sortBy ?? null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(seed?.sortDirection ?? "asc")
  // 2026-11-11 (explicit user decision — reversing the earlier auto-
  // suggestion mechanism): a brand-new report NEVER starts with a
  // pre-picked statistic — only the implicit row count, until the user
  // deliberately adds one. A saved report's own kpis (even []) always
  // wins, never mixed with a "starting" default (requirement 10).
  const [kpis, setKpis] = useState<AnalyticsSpec[]>(seed?.kpis ?? [])
  const [chartConfig, setChartConfig] = useState<AnalyticsSpec | null>(seed?.chartConfig ?? null)
  const [page, setPage] = useState(1)

  // Switching data source discards the current column/filter/sort
  // selection (a different source's fields are a different vocabulary) —
  // held here until the user confirms, so an accidental click never
  // silently loses work already done.
  const [pendingDataSource, setPendingDataSource] = useState<ReportDataSourceKey | null>(null)

  const [previewRows, setPreviewRows] = useState<ReportRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [kpiResults, setKpiResults] = useState<AnalyticsResult[]>([])
  const [chartResult, setChartResult] = useState<AnalyticsResult | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Any change to columns/filters/sort invalidates the current page — jump
  // back to page 1 rather than risk requesting a now out-of-range page.
  useEffect(() => {
    setPage(1)
  }, [dataSource, columns, filters, sortBy, sortDirection, kpis, chartConfig])

  const latestRequestId = useRef(0)

  // 2026-11-11 (requirement 8): the implicit row count is ALWAYS computed
  // by executeReport regardless of columns/kpis/chartConfig, so the
  // preview always runs — a user who only applies a filter can always
  // see the matching count, with nothing else selected.
  async function runPreview() {
    const requestId = ++latestRequestId.current
    setIsLoadingPreview(true)
    const result = await previewReportAction({
      dataSource,
      columns,
      filters,
      sortBy,
      sortDirection,
      page,
      pageSize: PAGE_SIZE,
      kpis,
      chartConfig,
    })
    if (requestId !== latestRequestId.current) return
    setIsLoadingPreview(false)
    if (result.success && result.data) {
      setPreviewRows(result.data.rows)
      setTotalCount(result.data.totalCount)
      setKpiResults(result.data.kpis)
      setChartResult(result.data.chart)
    }
  }

  // Pro mode only — debounced, auto-fires on every relevant change. Also
  // fires once right when the user switches INTO Pro (mode is in the deps
  // below), so anything changed while in Simple mode without pressing its
  // button is still reflected the moment Pro mode is opened.
  useEffect(() => {
    if (viewMode !== "pro") return
    const timeout = setTimeout(() => {
      runPreview()
    }, 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, dataSource, columns, filters, sortBy, sortDirection, page, kpis, chartConfig])

  // Simple mode only — runs once right when the user lands on Simple
  // (including the very first render, since viewMode starts as "simple"),
  // so there is already a sensible result to look at before anyone
  // touches "Hesabatı göstər" even once. Every later refresh in Simple
  // mode comes from that button's own onClick, not from this effect.
  useEffect(() => {
    if (viewMode !== "simple") return
    runPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])

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
    setKpis([])
    setChartConfig(null)
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
      kpis,
      chartConfig,
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
        { dataSource, columns, filters, sortBy, sortDirection, kpis, chartConfig },
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

  // Item 4/5 (2026-11-11): a field a KPI or the chart reads but that isn't
  // currently a selected column — offered as a one-click, OPT-IN chip,
  // never auto-added. Reusable for any field any analytics spec names,
  // regardless of data source.
  const suggestedColumnFields = useMemo(() => {
    const referenced = new Set<string>()
    for (const spec of kpis) if (spec.valueField) referenced.add(spec.valueField)
    if (chartConfig?.valueField) referenced.add(chartConfig.valueField)
    if (chartConfig?.groupBy?.field) referenced.add(chartConfig.groupBy.field)
    return Array.from(referenced).filter((key) => !columns.includes(key))
  }, [kpis, chartConfig, columns])

  function addSuggestedColumn(fieldKey: string) {
    if (!columns.includes(fieldKey)) setColumns([...columns, fieldKey])
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
          <Button type="button" variant="outline" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : <Download className="size-4" strokeWidth={1.75} />}
            {t("exportButton")}
          </Button>
          <Button type="button" onClick={() => setSaveDialogOpen(true)}>
            <Save className="size-4" strokeWidth={1.75} />
            {mode === "create" ? t("saveButton") : t("updateButton")}
          </Button>
        </div>
      </div>

      {/* Simple vs. Pro — same state, two views (see viewMode's own
       * comment above); switching never loses a filter/KPI/chart choice. */}
      <Tabs value={viewMode} onValueChange={(value) => value && setViewMode(value as "simple" | "pro")}>
        <TabsList>
          <TabsTrigger value="simple">{t("modeSimple")}</TabsTrigger>
          <TabsTrigger value="pro">{t("modePro")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {viewMode === "simple" ? (
        <ReportSimpleMode
          dataSource={dataSource}
          onDataSourceChange={requestDataSourceChange}
          filters={filters}
          onFiltersChange={setFilters}
          kpis={kpis}
          onKpisChange={setKpis}
          chartConfig={chartConfig}
          onChartConfigChange={setChartConfig}
          columns={columns}
          onColumnsChange={setColumns}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          onShowReport={runPreview}
          isLoading={isLoadingPreview}
          previewRows={previewRows}
          totalCount={totalCount}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          kpiResults={kpiResults}
          chartResult={chartResult}
        />
      ) : (
        // Two panels: controls (left) vs. results (right). Mobile stays a
        // single stacked column (the implicit grid-cols-1 below md);
        // medium screens use an adaptive 320-340px control column, large
        // screens fix it at 380px since it now also holds KPI/chart
        // parameters.
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(320px,340px)_1fr] lg:grid-cols-[380px_1fr]">
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
            <ReportFilterPanel dataSource={dataSource} filters={filters} onChange={setFilters} />
            <Separator />
            <ReportColumnPicker dataSource={dataSource} selectedColumns={columns} onChange={setColumns} />
            <Separator />
            <ReportSortControl dataSource={dataSource} sortBy={sortBy} sortDirection={sortDirection} onChange={handleSortChange} />
            <Separator />
            <ReportKpiPicker dataSource={dataSource} kpis={kpis} onChange={setKpis} />
            <Separator />
            <ReportChartConfigPanel dataSource={dataSource} chartConfig={chartConfig} onChange={setChartConfig} />
          </div>

          <div className="flex flex-col gap-6">
            <ReportKpiCards kpis={kpis} results={kpiResults} isLoading={isLoadingPreview} />
            <ReportChartDisplay chartConfig={chartConfig} result={chartResult} isLoading={isLoadingPreview} />
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("previewTitle")}</h2>
              {suggestedColumnFields.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("analyticsColumnSuggestionTitle")}</span>
                  {suggestedColumnFields.map((fieldKey) => {
                    const fieldDef = getReportFieldDefinition(fieldKey)
                    return (
                      <Button key={fieldKey} type="button" variant="outline" size="sm" onClick={() => addSuggestedColumn(fieldKey)}>
                        <Plus className="size-3.5" strokeWidth={1.75} />
                        {fieldDef ? tFields(fieldDef.labelKey) : fieldKey}
                      </Button>
                    )
                  })}
                </div>
              ) : null}
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
      )}

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
