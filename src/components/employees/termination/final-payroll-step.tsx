"use client"

import { useLocale, useTranslations } from "next-intl"

import { Card, CardContent } from "@/components/ui/card"
import { FormSection } from "@/components/common/form-section"
import type { PayrollSettlementItem } from "@/types/integrations/payroll"

interface StepProps {
  items: PayrollSettlementItem[]
  isLoading: boolean
}

export function FinalPayrollStep({ items, isLoading }: StepProps) {
  const t = useTranslations("Employees.termination.payroll")
  const locale = useLocale()

  if (isLoading) {
    return <FormSection title={t("title")}>{t("loading")}</FormSection>
  }

  function formatAmount(amount: number, currency: string) {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount)
  }

  return (
    <FormSection title={t("title")} description={t("description")}>
      <Card>
        <CardContent className="flex flex-col gap-0 divide-y divide-border p-0">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm text-foreground">{t(`items.${item.key}`)}</span>
              {item.amount === null ? (
                <span className="max-w-[55%] text-right text-xs text-muted-foreground">
                  {t("unavailable")}
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
    </FormSection>
  )
}
