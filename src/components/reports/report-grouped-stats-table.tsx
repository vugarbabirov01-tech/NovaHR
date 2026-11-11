"use client"

import { useFormatter, useTranslations } from "next-intl"
import { ListTree } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buildAnalyticsValueFormatters, formatAnalyticsValue, translateAnalyticsPointKey } from "@/lib/reports/analytics-format"
import type { AnalyticsResult, AnalyticsSpec } from "@/types/reports"

interface ReportGroupedStatsTableProps {
  chartConfig: AnalyticsSpec | null
  result: AnalyticsResult | null
  isLoading: boolean
}

/**
 * One of Simple mode's four result sections ("Qruplaşdırılmış statistika
 * cədvəli") — a plain [Qrup / Dəyər / Faiz] table over the exact same
 * `result` the chart itself renders, so the two never disagree. Reuses
 * the same translateAnalyticsPointKey/formatAnalyticsValue every other
 * analytics surface (KPI cards, the chart, the Excel Summary sheet) goes
 * through — never a second, slightly-different formatting path.
 */
export function ReportGroupedStatsTable({ chartConfig, result, isLoading }: ReportGroupedStatsTableProps) {
  const t = useTranslations("Reports.builder")
  const tFields = useTranslations("Reports.fields")
  const tEnum = useTranslations()
  const format = useFormatter()
  const formatters = buildAnalyticsValueFormatters(tFields, format.number)

  if (!chartConfig?.groupBy || !result) {
    return <EmptyState icon={ListTree} title={t("groupedStatsEmptyTitle")} description={t("groupedStatsEmptyDescription")} />
  }

  const groupBy = chartConfig.groupBy

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("summaryChartGroupColumn")}
            </TableHead>
            <TableHead className="h-10 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("groupedStatsValueColumn")}
            </TableHead>
            <TableHead className="h-10 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("summaryChartPercentageColumn")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className={isLoading ? "opacity-50" : undefined}>
          {result.points.map((point, index) => (
            <TableRow key={index}>
              <TableCell className="px-4 py-2.5">
                {translateAnalyticsPointKey(point.key, groupBy, {
                  translateMessagePath: tEnum,
                  otherLabel: t("chartOtherBucket"),
                  formatDateTime: format.dateTime,
                })}
              </TableCell>
              <TableCell className="px-4 py-2.5 tabular-nums">{formatAnalyticsValue(point.value, chartConfig, formatters)}</TableCell>
              <TableCell className="px-4 py-2.5 tabular-nums">{typeof point.percentage === "number" ? `${point.percentage}%` : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
