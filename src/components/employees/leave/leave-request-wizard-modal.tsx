"use client"

import { useTranslations } from "next-intl"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { LeaveRequestWizard } from "@/components/employees/leave/leave-request-wizard"
import type { LeaveType } from "@/repositories/leave-type-repository"
import type { EmployeeProfile } from "@/types/employee-profile"

interface LeaveRequestWizardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: EmployeeProfile
  leaveTypes: LeaveType[]
  onSuccess: () => void
}

/** Same Sheet-hosted, dynamically-imported pattern as EmployeeWizardModal —
 * lazy-loaded from leave-tab.tsx so this code (and the FileDropzone it
 * pulls in) never ships in the profile page's initial bundle. */
export function LeaveRequestWizardModal({
  open,
  onOpenChange,
  profile,
  leaveTypes,
  onSuccess,
}: LeaveRequestWizardModalProps) {
  const t = useTranslations("Employees.leaveRequest")

  function handleClose() {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t("wizardTitle")}</SheetTitle>
          <SheetDescription>{t("wizardDescription")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <LeaveRequestWizard
            key={profile.id}
            profile={profile}
            leaveTypes={leaveTypes}
            onSuccess={onSuccess}
            onClose={handleClose}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
