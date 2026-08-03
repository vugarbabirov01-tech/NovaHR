"use client"

import { useLocale, useTranslations } from "next-intl"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatLeaveUnitAmount } from "@/lib/leave/leave-unit-format"
import type { LeavePaymentSummary as LeavePaymentSummaryData } from "@/types/integrations/payroll"

interface LeavePaymentSummaryProps {
  payment: LeavePaymentSummaryData
  unit: "DAYS" | "HOURS"
}

function PaymentStat({ label, value, pendingLabel }: { label: string; value: string | null; pendingLabel: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={value === null ? "text-sm text-muted-foreground" : "text-sm font-medium text-foreground tabular-nums"}>
        {value ?? pendingLabel}
      </span>
    </div>
  )
}

function PaymentRow({ label, value, pendingLabel }: { label: string; value: string | null; pendingLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-sm text-foreground">{label}</span>
      {value === null ? (
        <span className="max-w-[55%] text-right text-xs text-muted-foreground">{pendingLabel}</span>
      ) : (
        <span className="text-sm font-medium text-foreground tabular-nums">{value}</span>
      )}
    </div>
  )
}

/**
 * Pure renderer for a Payroll-calculated leave payment breakdown — never
 * computes anything itself. Today `payment` comes from
 * payrollProvider.getLeavePaymentSummary's mock estimate (gross only,
 * everything else null); once a real Payroll engine exists, whatever calls
 * this swaps in that engine's result instead — same LeavePaymentSummary
 * shape, zero changes needed in this component.
 *
 * Deductions (tax/DSMF/unemployment/medical/net) collapse into a single
 * "will be calculated" note while `isFullyCalculated` is false — the moment
 * a real Payroll engine sets it true, this renders all five as individual
 * rows instead. Nothing about that future state is removed, only hidden
 * behind the flag until there's real data to show.
 */
export function LeavePaymentSummary({ payment, unit }: LeavePaymentSummaryProps) {
  const t = useTranslations("Employees.leaveRequest.review")
  const tLeave = useTranslations("Employees.profile.leave")
  const locale = useLocale()

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat(locale, { style: "currency", currency: payment.currency }).format(amount)
  }

  const pendingLabel = t("paymentPending")
  const grossValue = payment.grossAmount === null ? null : formatCurrency(payment.grossAmount)

  const deductionRows = [
    { key: "incomeTax", label: t("paymentIncomeTax"), value: payment.incomeTax },
    { key: "socialSecurityFund", label: t("paymentSocialSecurityFund"), value: payment.socialSecurityFund },
    { key: "unemploymentInsurance", label: t("paymentUnemploymentInsurance"), value: payment.unemploymentInsurance },
    { key: "medicalInsurance", label: t("paymentMedicalInsurance"), value: payment.medicalInsurance },
    { key: "netAmount", label: t("paymentNetAmount"), value: payment.netAmount },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("paymentSectionTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <PaymentStat
            label={t("paymentAverageMonthlySalary")}
            value={payment.averageMonthlySalary === null ? null : formatCurrency(payment.averageMonthlySalary)}
            pendingLabel={pendingLabel}
          />
          <PaymentStat
            label={t("paymentAverageDailySalary")}
            value={payment.averageDailySalary === null ? null : formatCurrency(payment.averageDailySalary)}
            pendingLabel={pendingLabel}
          />
          <PaymentStat
            label={t("paymentLeaveDays")}
            value={formatLeaveUnitAmount(tLeave, payment.leaveDays, unit)}
            pendingLabel={pendingLabel}
          />
        </div>

        <div className="flex flex-col gap-1 rounded-lg bg-muted/50 px-4 py-4">
          <span className="text-xs text-muted-foreground">{t("paymentGrossAmount")}</span>
          <span className="font-heading text-3xl font-semibold tracking-tight text-foreground tabular-nums">
            {grossValue ?? pendingLabel}
          </span>
        </div>

        {payment.isFullyCalculated ? (
          <div className="flex flex-col gap-0 divide-y divide-border border-t border-border">
            {deductionRows.map((row) => (
              <PaymentRow key={row.key} label={row.label} value={row.value === null ? null : formatCurrency(row.value)} pendingLabel={pendingLabel} />
            ))}
          </div>
        ) : (
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">{t("paymentNotCalculatedNote")}</p>
        )}
      </CardContent>
    </Card>
  )
}
