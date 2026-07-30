"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Stepper } from "@/components/common/stepper"
import {
  LeaveRequestDetailsStep,
  type LeaveRequestDetailsData,
} from "@/components/employees/leave/leave-request-details-step"
import { LeaveRequestReviewStep } from "@/components/employees/leave/leave-request-review-step"
import {
  previewLeaveRequestAction,
  submitLeaveRequestAction,
} from "@/lib/leave/leave-request-actions"
import type { LeaveRequestEvaluation } from "@/lib/leave/leave-request-service"
import type { LeaveType } from "@/repositories/leave-type-repository"
import type { EmployeeProfile } from "@/types/employee-profile"

const stepKeys = ["details", "review"] as const

const emptyDetails: LeaveRequestDetailsData = {
  leaveTypeId: "",
  startDate: "",
  numberOfDays: "",
  reason: "",
}

interface LeaveRequestWizardProps {
  profile: EmployeeProfile
  leaveTypes: LeaveType[]
  onSuccess: () => void
  onClose: () => void
}

/**
 * Two steps only, per Phase 3B scope — Details (Start Date + Number of
 * Days, HR's only real inputs) and Review & Submit (everything else is
 * calculated by the existing Leave Policy Resolution / Balance engines via
 * previewLeaveRequestAction, never recomputed here). Submission goes
 * through submitLeaveRequestAction, which re-evaluates server-side rather
 * than trusting this preview.
 *
 * Root layout is `flex h-full flex-col`: the modal wrapper
 * (leave-request-wizard-modal.tsx) gives this component the full height of
 * the dialog body, and this owns the internal scroll region itself so the
 * Back/Next/Submit footer stays pinned in view rather than requiring a
 * scroll to reach it — the Review step alone can be tall (several summary
 * cards) once real balance/warning data is present.
 */
export function LeaveRequestWizard({ profile, leaveTypes, onSuccess, onClose }: LeaveRequestWizardProps) {
  const t = useTranslations("Employees.leaveRequest")
  const [stepIndex, setStepIndex] = useState(0)
  const [details, setDetails] = useState<LeaveRequestDetailsData>(emptyDetails)
  const [errors, setErrors] = useState<Partial<Record<keyof LeaveRequestDetailsData, string>>>({})
  const [evaluation, setEvaluation] = useState<LeaveRequestEvaluation | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  const steps = stepKeys.map((key) => ({ key, label: t(`steps.${key}`) }))
  const leaveType = leaveTypes.find((lt) => lt.id === details.leaveTypeId)

  function patch(update: Partial<LeaveRequestDetailsData>) {
    setDetails((prev) => ({ ...prev, ...update }))
  }

  function validateDetails(): boolean {
    const nextErrors: Partial<Record<keyof LeaveRequestDetailsData, string>> = {}
    if (!details.leaveTypeId) nextErrors.leaveTypeId = t("validation.required")
    if (!details.startDate) nextErrors.startDate = t("validation.required")
    const numberOfDays = Number(details.numberOfDays)
    if (!details.numberOfDays || !Number.isFinite(numberOfDays) || numberOfDays <= 0) {
      nextErrors.numberOfDays = t("validation.required")
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleNext() {
    if (!validateDetails()) return
    setSubmitError(null)
    startTransition(async () => {
      const result = await previewLeaveRequestAction(
        profile.id,
        details.leaveTypeId,
        details.startDate,
        Number(details.numberOfDays)
      )
      if (result.success && result.data) {
        setEvaluation(result.data)
        setStepIndex(1)
      } else {
        setSubmitError(result.error ?? t("review.submitError"))
      }
    })
  }

  function handleBack() {
    setSubmitError(null)
    setStepIndex(0)
  }

  function handleSubmit() {
    setSubmitError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set("employeeId", profile.id)
      formData.set("leaveTypeId", details.leaveTypeId)
      formData.set("startDate", details.startDate)
      formData.set("numberOfDays", details.numberOfDays)
      if (details.reason.trim()) formData.set("reason", details.reason.trim())
      if (file) formData.set("document", file)

      const result = await submitLeaveRequestAction(formData)
      if (result.success) {
        setSubmitted(true)
        onSuccess()
      } else {
        if (result.evaluation) setEvaluation(result.evaluation)
        setSubmitError(
          result.error === "insufficient-balance" ? t("review.balanceBlocked") : t("review.submitError")
        )
      }
    })
  }

  if (submitted) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-status-good/10">
              <CheckCircle2 className="size-6 text-status-good" strokeWidth={1.75} />
            </div>
            <h2 className="font-heading text-lg font-semibold text-foreground">{t("successTitle")}</h2>
            <p className="max-w-sm text-sm text-muted-foreground">{t("successDescription")}</p>
            <Button className="mt-2" variant="outline" onClick={onClose}>
              {t("close")}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isLastStep = stepIndex === steps.length - 1

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex flex-col gap-6">
          <Stepper steps={steps} currentIndex={stepIndex} />
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

          {stepIndex === 0 ? (
            <Card>
              <CardContent>
                <LeaveRequestDetailsStep data={details} onChange={patch} leaveTypes={leaveTypes} errors={errors} />
              </CardContent>
            </Card>
          ) : null}
          {stepIndex === 1 && evaluation ? (
            <LeaveRequestReviewStep
              evaluation={evaluation}
              leaveTypeName={leaveType?.name ?? ""}
              unit={leaveType?.unit ?? "DAYS"}
              file={file}
              onFileChange={setFile}
            />
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-6 py-4">
        <Button variant="outline" onClick={handleBack} disabled={stepIndex === 0 || isPending}>
          <ChevronLeft className="size-4" strokeWidth={1.75} />
          {t("back")}
        </Button>

        {isLastStep ? (
          <Button
            onClick={handleSubmit}
            disabled={isPending || (evaluation ? evaluation.balanceValidationMode === "BLOCK" && !evaluation.isBalanceSufficient : true)}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {t("submit")}
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {t("next")}
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </Button>
        )}
      </div>
    </div>
  )
}
