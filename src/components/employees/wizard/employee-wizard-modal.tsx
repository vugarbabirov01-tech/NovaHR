"use client"

import { AlertCircle, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { EmployeeWizard } from "@/components/employees/wizard/employee-wizard"
import { profileToWizardData, type WizardMasterData } from "@/lib/employee-wizard-mapper"
import type { EmployeeProfile } from "@/types/employee-profile"

interface EmployeeWizardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
  /** Full profile for the employee being edited — null while it's loading. */
  editingProfile: EmployeeProfile | null
  /** Wizard master data (departments/positions/...) — fetched on demand the
   * moment Edit is clicked, null while it's loading. */
  masterData: WizardMasterData | null
  /** Set when either the profile or the master-data fetch failed, so the
   * modal never sits in the loading spinner forever. */
  loadError: boolean
  onRetry: () => void
  onSuccess: () => void
}

/**
 * Edit Employee only — Create restored to its own full page at
 * /employees/new (long-form data entry deserves the full content area, not
 * a side drawer). This is the one presentation container for editing:
 * reuses the exact same EmployeeWizard component the full-page Create flow
 * does, just hosted in a Sheet instead of a page, since edits are shorter,
 * more frequent interruptions that benefit from staying in list context.
 */
export function EmployeeWizardModal({
  open,
  onOpenChange,
  employeeId,
  editingProfile,
  masterData,
  loadError,
  onRetry,
  onSuccess,
}: EmployeeWizardModalProps) {
  const t = useTranslations("Employees.wizard")
  const isLoadingEditData = !editingProfile || !masterData

  function handleClose() {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t("editTitle")}</SheetTitle>
          <SheetDescription>{t("editDescription")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <AlertCircle className="size-6 text-destructive" strokeWidth={1.75} />
              <p className="max-w-xs text-sm text-muted-foreground">{t("editLoadError")}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleClose}>
                  {t("close")}
                </Button>
                <Button size="sm" onClick={onRetry}>
                  {t("retry")}
                </Button>
              </div>
            </div>
          ) : isLoadingEditData ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
            </div>
          ) : (
            <EmployeeWizard
              key={employeeId}
              mode="edit"
              employeeId={employeeId}
              initialData={profileToWizardData(editingProfile, masterData)}
              masterData={masterData}
              onSuccess={onSuccess}
              onClose={handleClose}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
