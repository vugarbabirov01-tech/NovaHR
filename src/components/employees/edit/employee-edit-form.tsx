"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, Loader2 } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/components/ui/toast"
import { PersonalStep } from "@/components/employees/wizard/personal-step"
import { EmploymentStep } from "@/components/employees/wizard/employment-step"
import { LabourLawStep } from "@/components/employees/wizard/labour-law-step"
import { PayrollStep } from "@/components/employees/wizard/payroll-step"
import { DocumentsStep } from "@/components/employees/wizard/documents-step"
import { cn } from "@/lib/utils"
import { validateEditEssentials, type WizardValidationErrors } from "@/lib/employee-wizard-validation"
import { updateEmployeeAction } from "@/app/[locale]/(app)/employees/actions"
import { wizardDataToProfile, type WizardMasterData } from "@/lib/employee-wizard-mapper"
import type { EmployeeWizardData } from "@/types/employee-wizard"

interface EmployeeEditFormProps {
  employeeId: string
  initialData: EmployeeWizardData
  masterData: WizardMasterData
  /** The Employees list URL this edit was entered from (see
   * employees/[id]/edit/page.tsx's own backHref) — forwarded onto both
   * Cancel and the post-save redirect's ?returnTo= so the Profile page
   * lands back on afterwards still knows which filtered list to return to.
   * Without this, Cancel/Save always dropped back to a bare profile URL,
   * losing the list's filters the moment Edit was involved. */
  returnTo: string
}

/**
 * Edit's own flow — deliberately not EmployeeWizard (that stays exactly as
 * Create left it, step-by-step, for onboarding). Every field is visible and
 * editable at once, grouped into the same sections the wizard already
 * defines (steps.personal/employment/labourLaw/payroll/documents), reusing
 * those exact step components — PersonalStep/EmploymentStep/etc. only ever
 * needed {data, onChange, errors} to begin with, so nothing about them
 * assumed "I'm one step in a sequence." Saving reuses updateEmployeeAction
 * unchanged, which already only overlays the wizard-owned fields onto the
 * existing record (src/lib/employee-edit-diff.ts) — leave, documents,
 * education, assets, notes, auditLog, employmentStatus, grade all pass
 * through untouched, exactly the "don't require re-confirming everything
 * else" and "don't lose other data" this form's callers ask for.
 */
export function EmployeeEditForm({
  employeeId,
  initialData,
  masterData: initialMasterData,
  returnTo,
}: EmployeeEditFormProps) {
  const t = useTranslations("Employees.wizard")
  const tCommon = useTranslations("Common")
  const router = useRouter()

  // Same shape as EmployeeCard/EmployeeListTable/EmployeeQuickActions'
  // profile links — the list URL this edit was entered from, carried
  // through to wherever this form sends the user back to the profile.
  const profileHref = `/employees/${employeeId}?returnTo=${encodeURIComponent(returnTo)}`

  const [data, setData] = useState<EmployeeWizardData>(initialData)
  const [errors, setErrors] = useState<WizardValidationErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [masterData, setMasterData] = useState<WizardMasterData>(initialMasterData)

  function patch(update: Partial<EmployeeWizardData>) {
    setData((prev) => ({ ...prev, ...update }))
  }

  function addDepartment(department: WizardMasterData["departments"][number]) {
    setMasterData((prev) => ({
      ...prev,
      departments: [...prev.departments, department].sort((a, b) => a.name.localeCompare(b.name)),
    }))
  }

  function addPosition(position: WizardMasterData["positions"][number]) {
    setMasterData((prev) => ({
      ...prev,
      positions: [...prev.positions, position].sort((a, b) => a.title.localeCompare(b.title)),
    }))
  }

  function addCompany(company: WizardMasterData["companies"][number]) {
    setMasterData((prev) => ({
      ...prev,
      companies: [...prev.companies, company].sort((a, b) => a.name.localeCompare(b.name)),
    }))
  }

  function addWorkSchedule(schedule: WizardMasterData["workSchedules"][number]) {
    setMasterData((prev) => ({
      ...prev,
      workSchedules: [...prev.workSchedules, schedule].sort((a, b) => a.label.localeCompare(b.label)),
    }))
  }

  function handleSave() {
    const essentialErrors = validateEditEssentials(data, { required: t("validation.required") })
    if (Object.keys(essentialErrors).length > 0) {
      setErrors(essentialErrors)
      setSubmitError(t("validation.fixErrors"))
      return
    }

    setErrors({})
    setSubmitError(null)
    startTransition(async () => {
      const profile = wizardDataToProfile(data, masterData)
      const result = await updateEmployeeAction(employeeId, profile)

      if (result.success) {
        toast.success(t("successTitleEdit"), t("successDescriptionEdit"))
        router.push(profileHref)
      } else if (result.error === "duplicate-employee-number") {
        setErrors({ employeeNumber: t("validation.duplicateEmployeeNumber") })
        setSubmitError(t("validation.duplicateEmployeeNumber"))
      } else if (result.error === "duplicate-fin") {
        setErrors({ finCode: t("validation.duplicateFin") })
        setSubmitError(t("validation.duplicateFin"))
      } else {
        setSubmitError(t("validation.saveFailed"))
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {submitError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("steps.personal")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PersonalStep data={data} onChange={patch} errors={errors} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("steps.employment")}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmploymentStep
            data={data}
            onChange={patch}
            errors={errors}
            masterData={masterData}
            mode="edit"
            onAddDepartment={addDepartment}
            onAddPosition={addPosition}
            onAddCompany={addCompany}
            onAddWorkSchedule={addWorkSchedule}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("steps.labourLaw")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LabourLawStep data={data} onChange={patch} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("steps.payroll")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PayrollStep data={data} onChange={patch} errors={errors} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("steps.documents")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentsStep data={data} onChange={patch} />
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Link href={profileHref} className={cn(buttonVariants({ variant: "outline" }))}>
          {tCommon("cancel")}
        </Link>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
          {t("submitEdit")}
        </Button>
      </div>
    </div>
  )
}
