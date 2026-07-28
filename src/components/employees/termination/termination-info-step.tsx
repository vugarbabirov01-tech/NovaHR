"use client"

import { useTranslations } from "next-intl"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/common/field"
import { FormSection } from "@/components/common/form-section"
import { EnumSelect } from "@/components/common/enum-select"
import type { TerminationValidationErrors } from "@/lib/termination/validation"
import type { TerminationWizardData } from "@/types/termination-wizard"
import type { TerminationReason } from "@/types/offboarding"

interface StepProps {
  data: TerminationWizardData
  onChange: (patch: Partial<TerminationWizardData>) => void
  errors?: TerminationValidationErrors
}

const reasons: TerminationReason[] = [
  "resignation",
  "employer-decision",
  "mutual-agreement",
  "end-of-contract",
  "retirement",
  "death",
  "other",
]

export function TerminationInfoStep({ data, onChange, errors = {} }: StepProps) {
  const t = useTranslations("Employees.termination.info")
  const tReasons = useTranslations("Employees.termination.reasons")
  const tCommon = useTranslations("Common")

  return (
    <FormSection title={t("title")} description={t("description")}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={t("terminationDate")}
          htmlFor="terminationDate"
          required
          error={errors.terminationDate}
        >
          <Input
            id="terminationDate"
            type="date"
            value={data.terminationDate}
            onChange={(e) => onChange({ terminationDate: e.target.value })}
          />
        </Field>
        <Field
          label={t("lastWorkingDay")}
          htmlFor="lastWorkingDay"
          required
          error={errors.lastWorkingDay}
        >
          <Input
            id="lastWorkingDay"
            type="date"
            value={data.lastWorkingDay}
            onChange={(e) => onChange({ lastWorkingDay: e.target.value })}
          />
        </Field>
        <Field label={t("reason")} htmlFor="reason" required error={errors.reason} className="sm:col-span-2">
          <EnumSelect
            id="reason"
            value={data.reason}
            onValueChange={(v) => onChange({ reason: v as TerminationReason })}
            options={reasons.map((reason) => ({ value: reason, label: tReasons(reason) }))}
            placeholder={tCommon("selectPlaceholder")}
          />
        </Field>
        <Field label={t("labourCodeArticle")} htmlFor="labourCodeArticle">
          <Input
            id="labourCodeArticle"
            value={data.labourCodeArticle}
            onChange={(e) => onChange({ labourCodeArticle: e.target.value })}
          />
        </Field>
        <Field label={t("notes")} htmlFor="notes" className="sm:col-span-2">
          <Textarea
            id="notes"
            rows={3}
            value={data.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </Field>
      </div>
    </FormSection>
  )
}
