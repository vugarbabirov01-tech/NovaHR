"use client"

import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

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
  mode: "create" | "edit"
  employeeId?: string
  /** Full profile for the employee being edited — null while it's loading. */
  editingProfile?: EmployeeProfile | null
  masterData: WizardMasterData
  onSuccess: () => void
}

/**
 * The single reusable shell for both Create and Edit — one EmployeeWizard
 * instance, opened as a drawer instead of a dedicated route, so Employee
 * List, Employee Card, and (later) Employee Profile can all trigger the
 * exact same flow. `key` forces a fresh EmployeeWizard mount whenever the
 * target changes (switching from editing one employee to another, or from
 * edit to create), since EmployeeWizard seeds its form state once from
 * `initialData` at mount and never again.
 */
export function EmployeeWizardModal({
  open,
  onOpenChange,
  mode,
  employeeId,
  editingProfile,
  masterData,
  onSuccess,
}: EmployeeWizardModalProps) {
  const t = useTranslations("Employees.wizard")
  const isLoadingEditData = mode === "edit" && !editingProfile

  function handleSuccess() {
    onSuccess()
  }

  function handleClose() {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{mode === "edit" ? t("editTitle") : t("title")}</SheetTitle>
          <SheetDescription>
            {mode === "edit" ? t("editDescription") : t("description")}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoadingEditData ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
            </div>
          ) : (
            <EmployeeWizard
              key={mode === "edit" ? employeeId : "create"}
              mode={mode}
              employeeId={employeeId}
              initialData={
                mode === "edit" && editingProfile
                  ? profileToWizardData(editingProfile, masterData)
                  : undefined
              }
              masterData={masterData}
              onSuccess={handleSuccess}
              onClose={handleClose}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
