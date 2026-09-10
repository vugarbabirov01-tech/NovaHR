"use client"

import { Building2 } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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
import { EmptyState } from "@/components/common/empty-state"
import type { DepartmentHeadcount } from "@/lib/dashboard-service"

interface DepartmentChartProps {
  /** Real, active-employees-only headcount per department — computed
   * server-side by getDepartmentHeadcounts (dashboard/page.tsx), never a
   * client-side mock. Empty when no active employee has a department set. */
  data: DepartmentHeadcount[]
}

export function DepartmentChart({ data }: DepartmentChartProps) {
  const t = useTranslations("Charts")
  const format = useFormatter()

  function ChartTooltip({
    active,
    payload,
  }: {
    active?: boolean
    payload?: { value: number; payload: { department: string } }[]
  }) {
    if (!active || !payload?.length) return null

    return (
      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
        <p className="font-medium text-popover-foreground">
          {payload[0].payload.department}
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
        <CardTitle>{t("departmentTitle")}</CardTitle>
        <CardDescription>{t("departmentDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="h-72 pr-4 pl-0">
        {data.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={t("departmentEmptyTitle")}
            description={t("departmentEmptyDescription")}
            className="h-full justify-center border-none px-0"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
              barSize={16}
            >
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="department"
                axisLine={false}
                tickLine={false}
                width={96}
                tick={{ fill: "var(--foreground)", fontSize: 12.5 }}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "var(--muted)" }}
              />
              <Bar dataKey="employees" fill="var(--chart-1)" radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="employees"
                  position="right"
                  className="fill-foreground text-xs font-medium tabular-nums"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
