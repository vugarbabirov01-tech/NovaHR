import { AlertTriangle, CalendarX2, Clock, LogIn, LogOut, UserX } from "lucide-react"
import { getFormatter, getTranslations } from "next-intl/server"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { KpiCard } from "@/components/common/kpi-card"
import { EmptyState } from "@/components/common/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AttendanceStatusBadge } from "@/components/attendance/attendance-status-badge"
import type { AttendanceTenantSummary } from "@/types/integrations/attendance"

interface AttendanceTenantSectionProps {
  summary: AttendanceTenantSummary
}

/**
 * One company's whole "bugünkü davamiyyət" card — KPI row + today's board,
 * both derived entirely from AttendanceTenantSummary (see
 * attendance-qr-provider.ts). Async Server Component, same convention as
 * KpiSection/RecentActivities (src/components/dashboard/) — resolves its
 * own translations, no client boundary, since nothing here is interactive.
 */
export async function AttendanceTenantSection({ summary }: AttendanceTenantSectionProps) {
  const t = await getTranslations("Attendance")
  const tStatus = await getTranslations("Attendance.status")
  const format = await getFormatter()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{summary.companyLabel}</CardTitle>
        <CardDescription>{t("todayDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!summary.available ? (
          <EmptyState
            icon={AlertTriangle}
            title={t(`unavailable.${summary.errorReason ?? "unreachable"}.title`)}
            description={t(`unavailable.${summary.errorReason ?? "unreachable"}.description`)}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label={t("checkIns")} value={format.number(summary.totalCheckIns)} icon={LogIn} />
              <KpiCard label={t("checkOuts")} value={format.number(summary.totalCheckOuts)} icon={LogOut} />
              <KpiCard label={t("late")} value={format.number(summary.lateCount)} icon={Clock} />
              <KpiCard label={t("absent")} value={format.number(summary.absentCount)} icon={UserX} />
            </div>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("columnEmployee")}</TableHead>
                  <TableHead>{t("columnLocation")}</TableHead>
                  <TableHead>{t("columnStatus")}</TableHead>
                  <TableHead>{t("columnCheckIn")}</TableHead>
                  <TableHead>{t("columnCheckOut")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState icon={CalendarX2} title={t("emptyTitle")} description={t("emptyDescription")} />
                    </TableCell>
                  </TableRow>
                ) : (
                  summary.rows.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{row.employeeName}</span>
                          {row.position ? (
                            <span className="text-xs text-muted-foreground">{row.position}</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.locationName}</TableCell>
                      <TableCell>
                        <AttendanceStatusBadge status={row.status} label={tStatus(row.status)} />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.checkInAt ? format.dateTime(new Date(row.checkInAt), { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.checkOutAt ? format.dateTime(new Date(row.checkOutAt), { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}
