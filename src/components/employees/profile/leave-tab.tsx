"use client"

import { useTranslations } from "next-intl"
import { CalendarClock, Info } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/common/empty-state"
import type { EmployeeProfile, LeaveRequestStatus } from "@/types/employee-profile"

interface LeaveTabProps {
  profile: EmployeeProfile
}

const statusVariant: Record<LeaveRequestStatus, "default" | "secondary" | "outline"> = {
  approved: "secondary",
  pending: "outline",
  rejected: "outline",
}

const statusMessageKeys: Record<LeaveRequestStatus, "statusApproved" | "statusPending" | "statusRejected"> = {
  approved: "statusApproved",
  pending: "statusPending",
  rejected: "statusRejected",
}

export function LeaveTab({ profile }: LeaveTabProps) {
  const t = useTranslations("Employees.profile.leave")
  const { leave } = profile

  const summary = [
    { label: t("annualLeave"), value: leave.annualLeaveEntitlement },
    { label: t("additionalLeave"), value: leave.additionalLeaveEntitlement },
    { label: t("usedLeave"), value: leave.usedLeaveDays },
    { label: t("remainingLeave"), value: leave.remainingLeaveDays },
  ]

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Info />
        <AlertDescription>{t("placeholderNotice")}</AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label}>
            <CardContent className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-heading text-2xl font-semibold text-foreground tabular-nums">
                {t("days", { count: item.value })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("leaveHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {leave.history.length === 0 ? (
            <EmptyState icon={CalendarClock} title={t("noHistory")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {leave.history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{entry.type}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {entry.startDate} – {entry.endDate}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {t("days", { count: entry.days })}
                    </span>
                    <Badge variant={statusVariant[entry.status]}>
                      {t(statusMessageKeys[entry.status])}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
