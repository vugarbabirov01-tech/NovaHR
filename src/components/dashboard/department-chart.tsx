"use client"

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
import { employeesByDepartment } from "@/data/dashboard-stats"

export function DepartmentChart() {
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
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={employeesByDepartment}
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
      </CardContent>
    </Card>
  )
}
