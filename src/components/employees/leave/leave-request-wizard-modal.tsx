"use client"

import { useTranslations } from "next-intl"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  LeaveRequestWizard,
  type LeaveRequestEmployeeOption,
} from "@/components/employees/leave/leave-request-wizard"
import type { LeaveType } from "@/repositories/leave-type-repository"

interface LeaveRequestWizardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-known employee — from that employee's own Leave tab, the wizard
   * skips straight to Leave Type. Omit when opening from the Leave
   * Dashboard's "Yeni Məzuniyyət" button, and pass `employeeOptions`
   * instead so the wizard's new Employee step has something to search. */
  employee?: { id: string; name: string }
  employeeOptions?: LeaveRequestEmployeeOption[]
  leaveTypes: LeaveType[]
  onSuccess: () => void
}

/**
 * A large, centered modal — previously a narrow (~672px max) side Sheet,
 * which was fine for a two-field form but not for a review step showing
 * calculated dates, a full balance breakdown, warnings, and an optional
 * attachment (and this wizard is expected to grow further: approvals,
 * holiday calculations). Desktop/tablet: ~90-95% of the viewport,
 * centered, backdrop blur (DialogOverlay already does this by default —
 * see dialog.tsx). Mobile: fullscreen, no wasted chrome. DialogHeader stays
 * fixed; LeaveRequestWizard owns its own internal scroll region so its Back
 * /Next/Submit footer stays pinned in view too, rather than requiring a
 * scroll to find it on a tall step like Review.
 */
export function LeaveRequestWizardModal({
  open,
  onOpenChange,
  employee,
  employeeOptions,
  leaveTypes,
  onSuccess,
}: LeaveRequestWizardModalProps) {
  const t = useTranslations("Employees.leaveRequest")

  function handleClose() {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        // Deliberately stays within the same top/left/translate longhand
        // property family DialogContent's own defaults use, rather than
        // mixing in `inset-*` — Tailwind utility cascade order is fixed by
        // its generated stylesheet, not by this string's write-order, so
        // pairing `inset-0` with `top-0`/`left-0` here would leave which
        // one wins genuinely ambiguous. Sticking to top/right/bottom/left
        // (the same properties the base classes already use) keeps every
        // override in a single, predictable twMerge conflict group.
        className="top-0 right-0 bottom-0 left-0 flex h-full max-h-full w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:h-[90vh] sm:max-h-[90vh] sm:w-[95vw] sm:max-w-[95vw] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl lg:w-[90vw] lg:max-w-[90vw]"
      >
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12">
          <DialogTitle>{t("wizardTitle")}</DialogTitle>
          <DialogDescription>{t("wizardDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <LeaveRequestWizard
            key={employee?.id ?? "new"}
            employee={employee}
            employeeOptions={employeeOptions}
            leaveTypes={leaveTypes}
            onSuccess={onSuccess}
            onClose={handleClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
