"use client"

import { useTranslations } from "next-intl"
import { CalendarClock } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/common/empty-state"
import { InfoField, InfoGrid } from "@/components/common/info-field"
import { FormSection } from "@/components/common/form-section"
import type { LeaveBalanceSummary } from "@/types/integrations/leave"

interface StepProps {
  leaveBalance: LeaveBalanceSummary | null
  isLoading: boolean
}

export function LeaveBalanceStep({ leaveBalance, isLoading }: StepProps) {
  const t = useTranslations("Employees.termination.leave")

  if (isLoading) {
    return <FormSection title={t("title")}>{t("loading")}</FormSection>
  }

  if (!leaveBalance) {
    return (
      <FormSection title={t("title")}>
        <Card>
          <CardContent>
            <EmptyState icon={CalendarClock} title={t("unavailable")} />
          </CardContent>
        </Card>
      </FormSection>
    )
  }

  return (
    <FormSection title={t("title")} description={t("description")}>
      <InfoGrid>
        <InfoField label={t("annualLeaveEarned")} value={t("days", { count: leaveBalance.annualLeaveEarned })} />
        <InfoField label={t("annualLeaveUsed")} value={t("days", { count: leaveBalance.annualLeaveUsed })} />
        <InfoField label={t("remainingLeave")} value={t("days", { count: leaveBalance.remainingLeave })} />
        <InfoField
          label={t("settlementMethod")}
          value={
            leaveBalance.settlementMethod
              ? t(`settlementMethods.${leaveBalance.settlementMethod}`)
              : t("settlementMethodUnavailable")
          }
        />
      </InfoGrid>
    </FormSection>
  )
}
