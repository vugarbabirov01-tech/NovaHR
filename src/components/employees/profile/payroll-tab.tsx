"use client"

import { useLocale, useTranslations } from "next-intl"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoField, InfoGrid } from "@/components/common/info-field"
import { EmptyState } from "@/components/common/empty-state"
import { Wallet } from "lucide-react"
import type { EmployeeProfile } from "@/types/employee-profile"

interface PayrollTabProps {
  profile: EmployeeProfile
}

export function PayrollTab({ profile }: PayrollTabProps) {
  const t = useTranslations("Employees.profile.payroll")
  const tTabs = useTranslations("Employees.profile.tabs")
  const locale = useLocale()
  const { payroll } = profile

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: payroll.currency }).format(amount)

  const totalCompensation =
    payroll.baseSalary + payroll.bonus + payroll.allowances.reduce((sum, a) => sum + a.amount, 0)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{tTabs("payroll")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField label={t("bank")} value={payroll.bankName} />
            <InfoField label={t("bankAccountNumber")} value={payroll.bankAccountNumber} />
            <InfoField label={t("salary")} value={formatMoney(payroll.baseSalary)} />
            <InfoField label={t("currency")} value={payroll.currency} />
            <InfoField label={t("bonus")} value={formatMoney(payroll.bonus)} />
            <InfoField label={t("compensation")} value={formatMoney(totalCompensation)} />
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("allowances")}</CardTitle>
        </CardHeader>
        <CardContent>
          {payroll.allowances.length === 0 ? (
            <EmptyState icon={Wallet} title={t("noAllowances")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {payroll.allowances.map((allowance) => (
                <li
                  key={allowance.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
                >
                  <span className="text-foreground">{allowance.label}</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {formatMoney(allowance.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {payroll.compensationNotes ? (
            <p className="mt-3 text-xs text-muted-foreground">{payroll.compensationNotes}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
