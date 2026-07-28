"use client"

import { useLocale, useTranslations } from "next-intl"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoField, InfoGrid } from "@/components/common/info-field"
import type { TerminationWizardData } from "@/types/termination-wizard"
import type { LeaveBalanceSummary } from "@/types/integrations/leave"
import type { PayrollSettlementItem } from "@/types/integrations/payroll"

interface StepProps {
  employeeName: string
  department: string
  position: string
  data: TerminationWizardData
  outstandingAssetCount: number
  leaveBalance: LeaveBalanceSummary | null
  payrollSummary: PayrollSettlementItem[]
  checklistCompletionPercent: number
}

export function TerminationReviewStep({
  employeeName,
  department,
  position,
  data,
  outstandingAssetCount,
  leaveBalance,
  payrollSummary,
  checklistCompletionPercent,
}: StepProps) {
  const t = useTranslations("Employees.termination.review")
  const tReasons = useTranslations("Employees.termination.reasons")
  const tPayrollItems = useTranslations("Employees.termination.payroll.items")
  const tPayroll = useTranslations("Employees.termination.payroll")
  const tLeave = useTranslations("Employees.termination.leave")
  const locale = useLocale()

  function formatAmount(amount: number, currency: string) {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-base font-semibold text-foreground">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("employee")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField label={t("employee")} value={employeeName} />
            <InfoField label={t("department")} value={department} />
            <InfoField label={t("position")} value={position} />
            <InfoField label={t("terminationDate")} value={data.terminationDate} />
            <InfoField label={t("lastWorkingDay")} value={data.lastWorkingDay} />
            <InfoField label={t("reason")} value={data.reason ? tReasons(data.reason) : ""} />
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("outstandingAssets")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-heading text-xl font-semibold text-foreground tabular-nums">
            {outstandingAssetCount}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("leaveBalance")}</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveBalance ? (
            <InfoGrid>
              <InfoField label={tLeave("remainingLeave")} value={tLeave("days", { count: leaveBalance.remainingLeave })} />
              <InfoField
                label={tLeave("settlementMethod")}
                value={
                  leaveBalance.settlementMethod
                    ? tLeave(`settlementMethods.${leaveBalance.settlementMethod}`)
                    : tLeave("settlementMethodUnavailable")
                }
              />
            </InfoGrid>
          ) : (
            <p className="text-sm text-muted-foreground">{tLeave("unavailable")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("payrollSummary")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-0 divide-y divide-border p-0">
          {payrollSummary.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-sm text-foreground">{tPayrollItems(item.key)}</span>
              {item.amount === null ? (
                <span className="max-w-[55%] text-right text-xs text-muted-foreground">
                  {tPayroll("unavailable")}
                </span>
              ) : (
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {formatAmount(item.amount, item.currency)}
                </span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("checklistCompletion")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-heading text-xl font-semibold text-foreground tabular-nums">
            {checklistCompletionPercent}%
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
