"use client"

import { useFormatter, useTranslations } from "next-intl"
import { BarChart3, Loader2 } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { EmptyState } from "@/components/common/empty-state"
import { Label } from "@/components/ui/label"
import { buildAnalyticsValueFormatters, formatAnalyticsValue, translateAnalyticsPointKey } from "@/lib/reports/analytics-format"
import { allowedChartTypesForBucket } from "@/lib/reports/field-registry"
import type { AnalyticsResult, AnalyticsSpec, ChartType } from "@/types/reports"

interface ReportChartDisplayProps {
  chartConfig: AnalyticsSpec | null
  result: AnalyticsResult | null
  isLoading: boolean
}

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

/**
 * Pure DISPLAY half of the chart — reads `chartConfig` only to know which
 * chart type/field it's rendering, never writes it (see
 * report-chart-config-panel.tsx for the half that does). The tooltip's
 * value text goes through the same formatAnalyticsValue every KPI card
 * uses, so a duration-flagged field (e.g. average tenure) reads as
 * "X il Y ay" here too, not a bare, unit-less number.
 */
export function ReportChartDisplay({ chartConfig, result, isLoading }: ReportChartDisplayProps) {
  const t = useTranslations("Reports.builder")
  const tFields = useTranslations("Reports.fields")
  const tEnum = useTranslations()
  const format = useFormatter()
  const formatters = buildAnalyticsValueFormatters(tFields, format.number)

  if (!chartConfig || !chartConfig.groupBy) {
    return (
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("chartTitle")}</Label>
        <div className="h-64 rounded-xl border border-border">
          <EmptyState icon={BarChart3} title={t("chartEmptyTitle")} description={t("chartEmptyDescription")} className="h-full justify-center border-none" />
        </div>
      </div>
    )
  }

  const groupBy = chartConfig.groupBy
  const currentChartType: ChartType = groupBy.chartType ?? allowedChartTypesForBucket(groupBy.bucket)[0]

  const chartData = (result?.points ?? []).map((point) => ({
    label: translateAnalyticsPointKey(point.key, groupBy, {
      translateMessagePath: tEnum,
      otherLabel: t("chartOtherBucket"),
      formatDateTime: format.dateTime,
    }),
    value: point.value,
    displayValue: formatAnalyticsValue(point.value, chartConfig, formatters),
    percentage: point.percentage,
  }))

  function ChartTooltip({
    active,
    payload,
  }: {
    active?: boolean
    payload?: { payload: { label: string; displayValue: string; percentage?: number } }[]
  }) {
    if (!active || !payload?.length) return null
    const point = payload[0].payload
    return (
      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
        <p className="font-medium text-popover-foreground">{point.label}</p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{point.displayValue}</span>
          {typeof point.percentage === "number" ? <span className="tabular-nums"> ({point.percentage}%)</span> : null}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("chartTitle")}</Label>
      <div className="h-64 rounded-xl border border-border">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.75} />
          </div>
        ) : chartData.length === 0 ? (
          <EmptyState icon={BarChart3} title={t("chartEmptyTitle")} description={t("chartEmptyDescription")} className="h-full justify-center border-none" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {currentChartType === "pie" ? (
              <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  outerRadius="80%"
                  label={(props: { payload?: { percentage?: number } }) =>
                    typeof props.payload?.percentage === "number" ? `${props.payload.percentage}%` : ""
                  }
                >
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            ) : currentChartType === "line" ? (
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
      {result?.cappedOther ? <p className="text-xs text-muted-foreground">{t("chartCappedOtherNotice")}</p> : null}
    </div>
  )
}
