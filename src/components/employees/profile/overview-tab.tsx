"use client"

import { useTranslations } from "next-intl"
import {
  Award,
  Briefcase,
  Building2,
  CalendarCheck2,
  ClipboardList,
  Mail,
  Phone,
  User,
  Users,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoField } from "@/components/common/info-field"
import { Timeline, type TimelineEntry } from "@/components/common/timeline"
import type { EmployeeProfile, EmploymentHistoryEventType } from "@/types/employee-profile"

interface OverviewTabProps {
  profile: EmployeeProfile
}

const historyIcons: Record<EmploymentHistoryEventType, typeof Briefcase> = {
  hire: Briefcase,
  promotion: Award,
  transfer: Users,
  "salary-change": ClipboardList,
  "status-change": ClipboardList,
  "contract-renewal": ClipboardList,
  termination: ClipboardList,
  rehire: Briefcase,
}

export function OverviewTab({ profile }: OverviewTabProps) {
  const t = useTranslations("Employees.profile.overview")
  const tPersonal = useTranslations("Employees.profile.personal")
  const tEmployment = useTranslations("Employees.profile.employment")
  const tHistoryTypes = useTranslations("Employees.profile.employment.historyTypes")

  const stats = [
    { label: t("tenure"), value: t("tenureYears", { years: profile.quickStats.tenureYears }), icon: CalendarCheck2 },
    { label: t("directReports"), value: profile.quickStats.directReports, icon: Users },
    { label: t("completedTrainings"), value: profile.quickStats.completedTrainings, icon: Award },
    { label: t("openTasks"), value: profile.quickStats.openTasks, icon: ClipboardList },
  ]

  const entries: TimelineEntry[] = profile.employment.history.map((event) => ({
    id: event.id,
    icon: historyIcons[event.type],
    title: `${tHistoryTypes(event.type)} — ${event.title}`,
    description: event.description,
    meta: event.date,
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="font-heading text-xl font-semibold text-foreground tabular-nums">
                  {stat.value}
                </p>
              </div>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent">
                <stat.icon className="size-4 text-accent-foreground" strokeWidth={1.75} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("timeline")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline entries={entries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("contact")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-4">
              <InfoField
                label={t("currentPosition")}
                value={
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="size-3.5 text-muted-foreground" />
                    {profile.employment.position}
                  </span>
                }
              />
              <InfoField
                label={tEmployment("company")}
                value={
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-muted-foreground" />
                    {profile.employment.company || t("noCompany")}
                  </span>
                }
              />
              <InfoField
                label={t("manager")}
                value={
                  <span className="flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground" />
                    {profile.employment.managerName ?? "—"}
                  </span>
                }
              />
              <InfoField
                label={tPersonal("email")}
                value={
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted-foreground" />
                    {profile.personal.email}
                  </span>
                }
              />
              <InfoField
                label={tPersonal("phone")}
                value={
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5 text-muted-foreground" />
                    {profile.personal.phone}
                  </span>
                }
              />
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
