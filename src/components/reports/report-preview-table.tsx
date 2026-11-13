"use client"

import { useFormatter, useTranslations } from "next-intl"
import { ChevronLeft, ChevronRight, FileSearch, TableIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buildDurationFormatter } from "@/lib/reports/analytics-format"
import { formatReportDate } from "@/lib/reports/format-date"
import { getEnumMessagePath, getReportFieldDefinition } from "@/lib/reports/field-registry"
import type { ReportColumn, ReportRow } from "@/types/reports"

interface ReportPreviewTableProps {
  columns: ReportColumn[]
  rows: ReportRow[]
  totalCount: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  isLoading: boolean
}

export function ReportPreviewTable({
  columns,
  rows,
  totalCount,
  page,
  pageSize,
  onPageChange,
  isLoading,
}: ReportPreviewTableProps) {
  const t = useTranslations("Reports.builder")
  const tFields = useTranslations("Reports.fields")
  const tEnum = useTranslations()
  const format = useFormatter()
  const formatDuration = buildDurationFormatter(tFields)

  if (columns.length === 0) {
    return (
      <EmptyState
        icon={TableIcon}
        title={t("previewNoColumnsTitle")}
        description={t("previewNoColumnsDescription")}
      />
    )
  }

  if (!isLoading && rows.length === 0) {
    return (
      <EmptyState
        icon={FileSearch}
        title={t("previewEmptyTitle")}
        description={t("previewEmptyDescription")}
      />
    )
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  function renderCell(row: ReportRow, column: ReportColumn) {
    const value = row[column]
    if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>

    const definition = getReportFieldDefinition(column)
    if (definition?.type === "enum") {
      const messagePath = getEnumMessagePath(definition, String(value))
      return <span>{messagePath ? tEnum(messagePath) : String(value)}</span>
    }
    // "X il Y ay" — rendered from the raw total-months number at display
    // time, the same deferred-translation precedent as enum values above
    // (see that field's own displayUnit comment in field-registry.ts).
    if (definition?.displayUnit === "durationMonths" && typeof value === "number") {
      return <span className="tabular-nums">{formatDuration(value)}</span>
    }
    // Locale-aware (comma/period decimal, thousands separator) — but no
    // repeated unit word per row here: unlike a KPI card, a detail
    // column's own header (e.g. "Yaş") already gives the number context.
    if (definition?.type === "number" && typeof value === "number") {
      return <span className="tabular-nums">{format.number(value, { maximumFractionDigits: 2 })}</span>
    }
    if (definition?.type === "date") {
      return <span className="tabular-nums">{formatReportDate(value)}</span>
    }
    if (definition?.type === "number") {
      return <span className="tabular-nums">{String(value)}</span>
    }
    return <span>{String(value)}</span>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead key={column} className="h-10 px-4 text-xs font-medium whitespace-nowrap text-muted-foreground uppercase tracking-wide">
                    {tFields(column)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className={isLoading ? "opacity-50" : undefined}>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column} className="px-4 py-3 whitespace-nowrap">
                      {renderCell(row, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t("totalRows", { count: totalCount })}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("pageOfTotal", { page, totalPages })}</span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            aria-label={t("previous")}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-3.5" strokeWidth={1.75} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages}
            aria-label={t("next")}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-3.5" strokeWidth={1.75} />
          </Button>
        </div>
      </div>
    </div>
  )
}
