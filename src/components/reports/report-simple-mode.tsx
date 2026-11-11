"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown, Loader2, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ReportDataSourceSelect } from "@/components/reports/report-data-source-select"
import { ReportFilterPanel } from "@/components/reports/report-filter-panel"
import { ReportColumnPicker } from "@/components/reports/report-column-picker"
import { ReportSortControl } from "@/components/reports/report-sort-control"
import { ReportKpiPicker } from "@/components/reports/report-kpi-picker"
import { ReportKpiCards } from "@/components/reports/report-kpi-cards"
import { ReportComparisonPicker } from "@/components/reports/report-comparison-picker"
import { ReportChartConfigPanel } from "@/components/reports/report-chart-config-panel"
import { ReportChartDisplay } from "@/components/reports/report-chart-display"
import { ReportGroupedStatsTable } from "@/components/reports/report-grouped-stats-table"
import { ReportPreviewTable } from "@/components/reports/report-preview-table"
import type { AnalyticsResult, AnalyticsSpec, ReportDataSourceKey, ReportFilter, ReportRow } from "@/types/reports"

const NAME_MATCHED_SOURCES: ReadonlySet<ReportDataSourceKey> = new Set(["COMPANIES", "DEPARTMENTS", "POSITIONS"])

interface ReportSimpleModeProps {
  dataSource: ReportDataSourceKey
  onDataSourceChange: (next: ReportDataSourceKey) => void
  filters: ReportFilter[]
  onFiltersChange: (filters: ReportFilter[]) => void
  kpis: AnalyticsSpec[]
  onKpisChange: (kpis: AnalyticsSpec[]) => void
  chartConfig: AnalyticsSpec | null
  onChartConfigChange: (chartConfig: AnalyticsSpec | null) => void
  columns: string[]
  onColumnsChange: (columns: string[]) => void
  sortBy: string | null
  sortDirection: "asc" | "desc"
  onSortChange: (sortBy: string | null, direction: "asc" | "desc") => void
  onShowReport: () => void
  isLoading: boolean
  previewRows: ReportRow[]
  totalCount: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  kpiResults: AnalyticsResult[]
  chartResult: AnalyticsResult | null
}

/**
 * Simple mode — the 4-question flow ("Nəyi araşdırmaq / Hansı şərtlərlə /
 * Nəyi hesablamaq / Nəyə görə müqayisə etmək istəyirəm?"), an explicit
 * "Hesabatı göstər" trigger instead of Pro mode's live auto-preview, and
 * secondary options tucked under "Ətraflı tənzimləmələr". Every field here
 * reads/writes the EXACT SAME state report-builder-client.tsx also hands
 * to Pro mode — there is no separate "simple state", so switching modes
 * can never lose anything (see that file's own comment on this). Never
 * shows a raw AnalyticsSpec/aggregation/bucket term — every label here is
 * a plain, translated word.
 */
export function ReportSimpleMode({
  dataSource,
  onDataSourceChange,
  filters,
  onFiltersChange,
  kpis,
  onKpisChange,
  chartConfig,
  onChartConfigChange,
  columns,
  onColumnsChange,
  sortBy,
  sortDirection,
  onSortChange,
  onShowReport,
  isLoading,
  previewRows,
  totalCount,
  page,
  pageSize,
  onPageChange,
  kpiResults,
  chartResult,
}: ReportSimpleModeProps) {
  const t = useTranslations("Reports.builder")
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const showNameMatchingNotice = NAME_MATCHED_SOURCES.has(dataSource)
  const showPayrollNotice = dataSource === "PAYROLL"

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium text-foreground">{t("simpleQ1")}</Label>
          <ReportDataSourceSelect value={dataSource} onChange={onDataSourceChange} />
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
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium text-foreground">{t("simpleQ2")}</Label>
          <ReportFilterPanel dataSource={dataSource} filters={filters} onChange={onFiltersChange} />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium text-foreground">{t("simpleQ3")}</Label>
          <ReportKpiPicker dataSource={dataSource} kpis={kpis} onChange={onKpisChange} />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium text-foreground">{t("simpleQ4")}</Label>
          <ReportComparisonPicker dataSource={dataSource} chartConfig={chartConfig} onChange={onChartConfigChange} />
        </div>
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ChevronDown className={cn("size-4 transition-transform", advancedOpen && "rotate-180")} strokeWidth={1.75} />
          {t("advancedSettingsTitle")}
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 pt-4">
          <ReportColumnPicker dataSource={dataSource} selectedColumns={columns} onChange={onColumnsChange} />
          <Separator />
          <ReportSortControl dataSource={dataSource} sortBy={sortBy} sortDirection={sortDirection} onChange={onSortChange} />
          {chartConfig ? (
            <>
              <Separator />
              <ReportChartConfigPanel dataSource={dataSource} chartConfig={chartConfig} onChange={onChartConfigChange} detailsOnly />
            </>
          ) : null}
        </CollapsibleContent>
      </Collapsible>

      <Button type="button" onClick={onShowReport} disabled={isLoading} className="w-fit">
        {isLoading ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : <Play className="size-4" strokeWidth={1.75} />}
        {t("showReportButton")}
      </Button>

      <div className="flex flex-col gap-6">
        <ReportKpiCards kpis={kpis} results={kpiResults} isLoading={isLoading} />
        {chartConfig ? (
          <>
            <ReportChartDisplay chartConfig={chartConfig} result={chartResult} isLoading={isLoading} />
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("groupedStatsTitle")}</Label>
              <ReportGroupedStatsTable chartConfig={chartConfig} result={chartResult} isLoading={isLoading} />
            </div>
          </>
        ) : null}
        {columns.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("previewTitle")}</Label>
            <ReportPreviewTable
              columns={columns}
              rows={previewRows}
              totalCount={totalCount}
              page={page}
              pageSize={pageSize}
              onPageChange={onPageChange}
              isLoading={isLoading}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
