"use client"

import { useRouter } from "@/i18n/navigation"
import { TerminationWizard } from "@/components/employees/termination/termination-wizard"
import type { EmployeeProfile } from "@/types/employee-profile"

interface TerminationPageContentProps {
  employeeId: string
  profile: EmployeeProfile
}

/**
 * The only thing this adds over rendering TerminationWizard directly is the
 * router-based onSuccess/onClose a full page needs instead of a Sheet's
 * open/onOpenChange — the wizard itself, every step, and all of its business
 * logic are untouched and reused exactly as they are.
 */
export function TerminationPageContent({ employeeId, profile }: TerminationPageContentProps) {
  const router = useRouter()

  function handleSuccess() {
    router.refresh()
  }

  function handleClose() {
    router.push(`/employees/${employeeId}`)
  }

  return (
    <TerminationWizard
      employeeId={employeeId}
      profile={profile}
      onSuccess={handleSuccess}
      onClose={handleClose}
    />
  )
}
