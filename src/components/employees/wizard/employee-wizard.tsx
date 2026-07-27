"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Stepper } from "@/components/common/stepper"
import { PersonalStep } from "@/components/employees/wizard/personal-step"
import { EmploymentStep } from "@/components/employees/wizard/employment-step"
import { LabourLawStep } from "@/components/employees/wizard/labour-law-step"
import { PayrollStep } from "@/components/employees/wizard/payroll-step"
import { DocumentsStep } from "@/components/employees/wizard/documents-step"
import { ReviewStep } from "@/components/employees/wizard/review-step"
import { cn } from "@/lib/utils"
import {
  validateAllWizardSteps,
  validateWizardStep,
  type WizardValidationErrors,
} from "@/lib/employee-wizard-validation"
import { createEmployeeAction, updateEmployeeAction } from "@/app/[locale]/(app)/employees/actions"
import { wizardDataToProfile, type WizardMasterData } from "@/lib/employee-wizard-mapper"
import { defaultWizardData, type EmployeeWizardData } from "@/types/employee-wizard"

const stepKeys = ["personal", "employment", "labourLaw", "payroll", "documents", "review"] as const

interface EmployeeWizardProps {
  masterData: WizardMasterData
  mode?: "create" | "edit"
  employeeId?: string
  initialData?: EmployeeWizardData
  onSuccess?: (id: string) => void
  onClose?: () => void
}

export function EmployeeWizard({
  masterData: initialMasterData,
  mode = "create",
  employeeId,
  initialData,
  onSuccess,
  onClose,
}: EmployeeWizardProps) {
  const t = useTranslations("Employees.wizard")
  const tProfile = useTranslations("Employees.profile")
  const [stepIndex, setStepIndex] = useState(0)
  const [data, setData] = useState<EmployeeWizardData>(initialData ?? defaultWizardData)
  const [errors, setErrors] = useState<WizardValidationErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [newEmployeeId, setNewEmployeeId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // The wizard only ever reads master data — but once a Quick Create modal
  // adds a record via the real Administration Server Action, the newly
  // created row needs to appear in the relevant Select immediately, with no
  // page refresh. This local copy starts as the server-fetched snapshot and
  // only ever grows by appending records the Server Actions actually
  // persisted — it is never used to fabricate data client-side.
  const [masterData, setMasterData] = useState<WizardMasterData>(initialMasterData)

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

  function addBranch(branch: WizardMasterData["branches"][number]) {
    setMasterData((prev) => ({
      ...prev,
      branches: [...prev.branches, branch].sort((a, b) => a.name.localeCompare(b.name)),
    }))
  }

  function addWorkSchedule(schedule: WizardMasterData["workSchedules"][number]) {
    setMasterData((prev) => ({
      ...prev,
      workSchedules: [...prev.workSchedules, schedule].sort((a, b) => a.label.localeCompare(b.label)),
    }))
  }

  const steps = stepKeys.map((key) => ({ key, label: t(`steps.${key}`) }))
  const validationMessages = {
    required: t("validation.required"),
  }

  function patch(update: Partial<EmployeeWizardData>) {
    setData((prev) => ({ ...prev, ...update }))
  }

  function goToStep(index: number) {
    setStepIndex(index)
    setSubmitError(null)
  }

  function handleNext() {
    const stepErrors = validateWizardStep(stepIndex, data, validationMessages)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    goToStep(Math.min(steps.length - 1, stepIndex + 1))
  }

  function handleBack() {
    setErrors({})
    goToStep(Math.max(0, stepIndex - 1))
  }

  function handleSubmit() {
    const { firstInvalidStep, errorsByStep } = validateAllWizardSteps(data, validationMessages)
    if (firstInvalidStep !== null) {
      setErrors(errorsByStep[firstInvalidStep])
      goToStep(firstInvalidStep)
      setSubmitError(t("validation.fixErrors"))
      return
    }

    setErrors({})
    setSubmitError(null)
    startTransition(async () => {
      const profile = wizardDataToProfile(data, masterData)
      const result =
        mode === "edit" && employeeId
          ? await updateEmployeeAction(employeeId, profile)
          : await createEmployeeAction(profile)
      if (result.success && result.id) {
        setNewEmployeeId(result.id)
        onSuccess?.(result.id)
      } else if (result.error === "duplicate-id" || result.error === "duplicate-employee-number") {
        setErrors({ employeeNumber: t("validation.duplicateEmployeeNumber") })
        setSubmitError(t("validation.duplicateEmployeeNumber"))
        goToStep(1)
      } else {
        setSubmitError(t("validation.saveFailed"))
      }
    })
  }

  if (newEmployeeId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-status-good/10">
            <CheckCircle2 className="size-6 text-status-good" strokeWidth={1.75} />
          </div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {mode === "edit" ? t("successTitleEdit") : t("successTitle")}
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {mode === "edit" ? t("successDescriptionEdit") : t("successDescription")}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {onClose ? (
              <Button variant="outline" onClick={onClose}>
                {tProfile("backToList")}
              </Button>
            ) : (
              <Link href="/employees" className={cn(buttonVariants({ variant: "outline" }))}>
                {tProfile("backToList")}
              </Link>
            )}
            <Link href={`/employees/${newEmployeeId}`} className={cn(buttonVariants())}>
              {t("viewProfile")}
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isLastStep = stepIndex === steps.length - 1

  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={steps} currentIndex={stepIndex} onStepClick={goToStep} />
      <div className="flex flex-col gap-1.5 lg:hidden">
        <span className="text-sm text-muted-foreground">
          {t("stepIndicator", { current: stepIndex + 1, total: steps.length })}
        </span>
        <Progress value={((stepIndex + 1) / steps.length) * 100} />
      </div>

      {submitError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          {stepIndex === 0 ? <PersonalStep data={data} onChange={patch} errors={errors} /> : null}
          {stepIndex === 1 ? (
            <EmploymentStep
              data={data}
              onChange={patch}
              errors={errors}
              masterData={masterData}
              onAddDepartment={addDepartment}
              onAddPosition={addPosition}
              onAddCompany={addCompany}
              onAddBranch={addBranch}
              onAddWorkSchedule={addWorkSchedule}
            />
          ) : null}
          {stepIndex === 2 ? <LabourLawStep data={data} onChange={patch} /> : null}
          {stepIndex === 3 ? <PayrollStep data={data} onChange={patch} errors={errors} /> : null}
          {stepIndex === 4 ? <DocumentsStep data={data} onChange={patch} /> : null}
          {stepIndex === 5 ? <ReviewStep data={data} masterData={masterData} mode={mode} /> : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} disabled={stepIndex === 0 || isPending}>
          <ChevronLeft className="size-4" strokeWidth={1.75} />
          {t("back")}
        </Button>

        {isLastStep ? (
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {mode === "edit" ? t("submitEdit") : t("submit")}
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={isPending}>
            {t("next")}
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </Button>
        )}
      </div>
    </div>
  )
}
