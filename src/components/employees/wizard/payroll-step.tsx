"use client"

import { useTranslations } from "next-intl"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/common/field"
import { FormSection } from "@/components/common/form-section"
import { EnumSelect } from "@/components/common/enum-select"
import { currencies } from "@/data/employee-options"
import type { WizardValidationErrors } from "@/lib/employee-wizard-validation"
import type { EmployeeWizardData } from "@/types/employee-wizard"

interface StepProps {
  data: EmployeeWizardData
  onChange: (patch: Partial<EmployeeWizardData>) => void
  errors?: WizardValidationErrors
}

export function PayrollStep({ data, onChange, errors = {} }: StepProps) {
  const t = useTranslations("Employees.profile.payroll")
  const tTabs = useTranslations("Employees.profile.tabs")
  const tCommon = useTranslations("Common")

  return (
    <FormSection title={tTabs("payroll")}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("bank")} htmlFor="bankName">
          <Input id="bankName" value={data.bankName} onChange={(e) => onChange({ bankName: e.target.value })} />
        </Field>
        <Field label={t("bankAccountNumber")} htmlFor="bankAccountNumber">
          <Input
            id="bankAccountNumber"
            value={data.bankAccountNumber}
            onChange={(e) => onChange({ bankAccountNumber: e.target.value })}
          />
        </Field>
        <Field label={t("salary")} htmlFor="baseSalary" required error={errors.baseSalary}>
          <Input
            id="baseSalary"
            type="number"
            min={0}
            value={data.baseSalary}
            onChange={(e) => onChange({ baseSalary: e.target.value === "" ? "" : Number(e.target.value) })}
          />
        </Field>
        <Field label={t("currency")} htmlFor="currency" required error={errors.currency}>
          <EnumSelect
            id="currency"
            value={data.currency}
            onValueChange={(v) => onChange({ currency: v || "AZN" })}
            options={currencies.map((c) => ({ value: c, label: c }))}
            placeholder={tCommon("selectPlaceholder")}
          />
        </Field>
        <Field label={t("bonus")} htmlFor="bonus">
          <Input
            id="bonus"
            type="number"
            min={0}
            value={data.bonus}
            onChange={(e) => onChange({ bonus: Number(e.target.value) })}
          />
        </Field>
        <Field label={t("compensationNotes")} htmlFor="compensationNotes" className="sm:col-span-2">
          <Textarea
            id="compensationNotes"
            rows={2}
            value={data.compensationNotes}
            onChange={(e) => onChange({ compensationNotes: e.target.value })}
          />
        </Field>
      </div>
    </FormSection>
  )
}
