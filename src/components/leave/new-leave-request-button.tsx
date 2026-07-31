"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { Loader2, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { LeaveRequestEmployeeOption } from "@/components/employees/leave/leave-request-wizard"
import type { LeaveType } from "@/repositories/leave-type-repository"

// Same lazy-loading reasoning as the Employee Profile Leave tab's own
// wizard trigger — the wizard (and the FileDropzone it pulls in) is one
// click away from never being opened in a given dashboard visit.
const LeaveRequestWizardModal = dynamic(
  () =>
    import("@/components/employees/leave/leave-request-wizard-modal").then(
      (mod) => mod.LeaveRequestWizardModal
    ),
  {
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
      </div>
    ),
  }
)

interface NewLeaveRequestButtonProps {
  employeeOptions: LeaveRequestEmployeeOption[]
  leaveTypes: LeaveType[]
}

/**
 * The Leave Dashboard's primary action — assigning leave without already
 * being on a specific employee's profile, so the wizard opens with no
 * `employee` pre-selected and its Employee step (searchable autocomplete)
 * is what the HR user sees first. Once submitted, submitLeaveRequestAction's
 * own revalidatePath calls refresh this page's KPIs and table automatically
 * (see leave-request-actions.ts) — this component only needs to close the
 * modal, not refetch anything itself.
 */
export function NewLeaveRequestButton({ employeeOptions, leaveTypes }: NewLeaveRequestButtonProps) {
  const t = useTranslations("Leave.dashboard")
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="size-4" strokeWidth={1.75} />
        {t("newLeave")}
      </Button>
      {isOpen ? (
        <LeaveRequestWizardModal
          open={isOpen}
          onOpenChange={setIsOpen}
          employeeOptions={employeeOptions}
          leaveTypes={leaveTypes}
          onSuccess={() => setIsOpen(false)}
        />
      ) : null}
    </>
  )
}
