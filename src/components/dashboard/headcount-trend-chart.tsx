"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { headcountTrend } from "@/data/dashboard-stats"

export function HeadcountTrendChart() {
  const t = useTranslations("Charts")
  const tCommon = useTranslations("Common")
  const format = useFormatter()
  const monthsShort = tCommon.raw("monthsShort") as string[]

  const formatMonth = (value: string) => monthsShort[new Date(value).getUTCMonth()]

  function ChartTooltip({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: { value: number }[]
    label?: string
  }) {
    if (!active || !payload?.length || !label) return null

    return (
      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
        <p className="font-medium text-popover-foreground">
          {formatMonth(label)}
        </p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">
            {format.number(payload[0].value)}
          </span>{" "}
          {t("employeesUnit")}
        </p>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("headcountTrendTitle")}</CardTitle>
        <CardDescription>{t("headcountTrendDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="h-72 pr-4 pl-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={headcountTrend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="headcountFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="monthDate"
              tickFormatter={formatMonth}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              width={44}
              tickFormatter={(value: number) => `${Math.round(value / 1000 * 10) / 10}k`}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="headcount"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#headcountFill)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
