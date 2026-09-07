"use client"

import { useTranslations } from "next-intl"
import { Award, Briefcase, ClipboardList, Users } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoField, InfoGrid } from "@/components/common/info-field"
import { EmptyState } from "@/components/common/empty-state"
import { Timeline, type TimelineEntry } from "@/components/common/timeline"
import {
  contractTypeMessageKeys,
  employmentTypeMessageKeys,
  workLocationTypeMessageKeys,
} from "@/lib/employees"
import type { EmployeeProfile, EmploymentHistoryEventType } from "@/types/employee-profile"

interface EmploymentTabProps {
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

export function EmploymentTab({ profile }: EmploymentTabProps) {
  const t = useTranslations("Employees.profile.employment")
  const tTabs = useTranslations("Employees.profile.tabs")
  const tType = useTranslations("EmploymentType")
  const tContract = useTranslations("ContractType")
  const tLocation = useTranslations("WorkLocationType")
  const tHistoryTypes = useTranslations("Employees.profile.employment.historyTypes")

  const { employment } = profile

  const entries: TimelineEntry[] = employment.history.map((event) => ({
    id: event.id,
    icon: historyIcons[event.type],
    title: `${tHistoryTypes(event.type)} — ${event.title}`,
    description: event.description,
    meta: event.date,
  }))

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{tTabs("employment")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField label={t("employeeNumber")} value={employment.employeeNumber} />
            <InfoField label={t("hireDate")} value={employment.hireDate} />
            <InfoField label={t("probationEndDate")} value={employment.probationEndDate} />
            <InfoField
              label={t("employmentType")}
              value={tType(employmentTypeMessageKeys[employment.employmentType])}
            />
            <InfoField
              label={t("contractType")}
              value={tContract(contractTypeMessageKeys[employment.contractType])}
            />
            <InfoField label={t("department")} value={employment.department} />
            <InfoField label={t("position")} value={employment.position} />
            <InfoField label={t("grade")} value={employment.grade} />
            <InfoField label={t("company")} value={employment.company} />
            <InfoField
              label={t("workLocationType")}
              value={tLocation(workLocationTypeMessageKeys[employment.workLocationType])}
            />
            <InfoField label={t("workLocation")} value={employment.workLocation} />
            <InfoField label={t("manager")} value={employment.managerName} />
            <InfoField label={t("workSchedule")} value={employment.workSchedule} />
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("employmentHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <EmptyState icon={Briefcase} title={t("noHistory")} />
          ) : (
            <Timeline entries={entries} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
