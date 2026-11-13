"use client"

import { useTranslations } from "next-intl"

import { completeHireAction } from "@/app/[locale]/(app)/recruitment/actions"
import { EmployeeWizard } from "@/components/employees/wizard/employee-wizard"
import { toast } from "@/components/ui/toast"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"
import type { EmployeeWizardData } from "@/types/employee-wizard"

interface HireWizardProps {
  applicationId: string
  masterData: WizardMasterData
  initialData: EmployeeWizardData
}

/**
 * The normal "new employee" wizard, pre-filled from the accepted offer. When
 * the employee record is created the application is marked HIRED and linked.
 */
export function HireWizard({ applicationId, masterData, initialData }: HireWizardProps) {
  const t = useTranslations("Recruitment")

  async function handleCreated(employeeId: string) {
    const result = await completeHireAction(applicationId, employeeId)
    if (!result.success) toast.error(t(`errors.${result.code}` as never))
  }

  return <EmployeeWizard masterData={masterData} initialData={initialData} onSuccess={handleCreated} />
}
