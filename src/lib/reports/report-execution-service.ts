import { computeAnalytics } from "@/lib/reports/aggregation-engine"
import { fetchRowsForDataSource } from "@/lib/reports/data-source-registry"
import { applyFilters, sortRows } from "@/lib/reports/filter-engine"
import type {
  AnalyticsSpec,
  ReportColumn,
  ReportDataSourceKey,
  ReportFilter,
  ReportPreviewResult,
  ReportRow,
} from "@/types/reports"

function projectColumns(row: ReportRow, columns: ReportColumn[]): ReportRow {
  const projected: ReportRow = {}
  for (const column of columns) projected[column] = row[column] ?? null
  return projected
}

export interface ExecuteReportInput {
  dataSource: ReportDataSourceKey
  columns: ReportColumn[]
  filters: ReportFilter[]
  sortBy: string | null
  sortDirection: "asc" | "desc"
  /** 1-based. Omit (with pageSize) to get every matching row — used by export. */
  page?: number
  pageSize?: number
  /** User-selected KPIs (no groupBy) — the implicit row-count KPI is
   * always prepended regardless of this list, see below. */
  kpis?: AnalyticsSpec[]
  chartConfig?: AnalyticsSpec | null
  /** "Top N": keep only the first N rows after sorting (positive integer).
   * Applies to the table rows and totalCount only — KPIs and the chart
   * still describe the full filtered set. Not persisted on a saved
   * ReportDefinition yet (that needs a schema change), so only callers
   * that build the input themselves (templates, future AI search) use it. */
  rowLimit?: number
}

/**
 * The one place that composes fetch -> filter -> sort -> paginate ->
 * project-to-selected-columns, for both the builder's live preview and
 * Export (which calls this with no page/pageSize to get every row). Always
 * re-reads the live Employee table — a ReportDefinition is a recipe, never
 * a cached result (see that model's own schema comment).
 *
 * KPIs and the chart are computed from `filtered` — the full matching set,
 * BEFORE pagination — so they always reflect every matching row, never
 * just the page currently on screen (2026-11-11 universal-architecture
 * requirement). Neither this function nor aggregation-engine.ts branches
 * on `dataSource` anywhere below.
 */
export async function executeReport(input: ExecuteReportInput): Promise<ReportPreviewResult> {
  const allRows = await fetchRowsForDataSource(input.dataSource)
  const filtered = applyFilters(allRows, input.filters)
  const sortedAll = sortRows(filtered, input.sortBy, input.sortDirection)
  const sorted =
    input.rowLimit !== undefined && Number.isInteger(input.rowLimit) && input.rowLimit > 0
      ? sortedAll.slice(0, input.rowLimit)
      : sortedAll
  const totalCount = sorted.length

  const page = input.page && input.pageSize ? sorted.slice((input.page - 1) * input.pageSize, input.page * input.pageSize) : sorted

  const rowCountKpi = computeAnalytics(filtered, { aggregation: "count" })
  const extraKpis = (input.kpis ?? []).map((spec) => computeAnalytics(filtered, spec))
  const chart = input.chartConfig ? computeAnalytics(filtered, input.chartConfig) : null

  return {
    rows: page.map((row) => projectColumns(row, input.columns)),
    totalCount,
    kpis: [rowCountKpi, ...extraKpis],
    chart,
  }
}
