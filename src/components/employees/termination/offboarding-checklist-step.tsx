"use client"

import { useTranslations } from "next-intl"

import { Checklist, type ChecklistItem } from "@/components/common/checklist"
import { FormSection } from "@/components/common/form-section"
import type { OffboardingChecklistState } from "@/types/offboarding"

interface StepProps {
  checklist: OffboardingChecklistState
  onChange: (checklist: OffboardingChecklistState) => void
}

const checklistKeys: (keyof OffboardingChecklistState)[] = [
  "companyPropertyReturned",
  "accessCardDisabled",
  "companyEmailDisabled",
  "hrmsAccountDisabled",
  "exitInterviewCompleted",
  "documentsDelivered",
  "finalSettlementApproved",
]

export function OffboardingChecklistStep({ checklist, onChange }: StepProps) {
  const t = useTranslations("Employees.termination.checklist")

  const items: ChecklistItem[] = checklistKeys.map((key) => ({ key, label: t(`items.${key}`) }))

  return (
    <FormSection title={t("title")} description={t("description")}>
      <Checklist
        items={items}
        value={checklist as unknown as Record<string, boolean>}
        onChange={(value) => onChange(value as unknown as OffboardingChecklistState)}
        completionLabel={() => t("completionLabel")}
      />
    </FormSection>
  )
}
