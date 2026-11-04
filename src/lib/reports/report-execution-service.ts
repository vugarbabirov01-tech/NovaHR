import { fetchRowsForDataSource } from "@/lib/reports/data-source-registry"
import { applyFilters, sortRows } from "@/lib/reports/filter-engine"
import type { ReportColumn, ReportDataSourceKey, ReportFilter, ReportPreviewResult, ReportRow } from "@/types/reports"

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
}

/**
 * The one place that composes fetch -> filter -> sort -> paginate ->
 * project-to-selected-columns, for both the builder's live preview and
 * Export (which calls this with no page/pageSize to get every row). Always
 * re-reads the live Employee table — a ReportDefinition is a recipe, never
 * a cached result (see that model's own schema comment).
 */
export async function executeReport(input: ExecuteReportInput): Promise<ReportPreviewResult> {
  const allRows = await fetchRowsForDataSource(input.dataSource)
  const filtered = applyFilters(allRows, input.filters)
  const sorted = sortRows(filtered, input.sortBy, input.sortDirection)
  const totalCount = sorted.length

  const page = input.page && input.pageSize ? sorted.slice((input.page - 1) * input.pageSize, input.page * input.pageSize) : sorted

  return { rows: page.map((row) => projectColumns(row, input.columns)), totalCount }
}
