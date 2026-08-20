"use client"

import { useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Stepper } from "@/components/common/stepper"
import { Field } from "@/components/common/field"
import { SearchableSelect } from "@/components/common/searchable-select"
import {
  LeaveRequestDetailsStep,
  type LeaveRequestDetailsData,
} from "@/components/employees/leave/leave-request-details-step"
import { LeaveRequestReviewStep } from "@/components/employees/leave/leave-request-review-step"
import {
  getLeavePaymentSummaryAction,
  previewLeaveRequestAction,
  submitLeaveRequestAction,
} from "@/lib/leave/leave-request-actions"
import { formatLeaveUnitAmount } from "@/lib/leave/leave-unit-format"
import type { LeaveRequestEvaluation } from "@/lib/leave/leave-request-service"
import type { LeaveType } from "@/repositories/leave-type-repository"
import type { LeavePaymentSummary } from "@/types/integrations/payroll"

type StepKey = "employee" | "details" | "review"

const emptyDetails: LeaveRequestDetailsData = {
  leaveTypeId: "",
  leavePeriodStartYear: "",
  startDate: "",
  numberOfDays: "",
  reason: "",
}

export interface LeaveRequestEmployeeOption {
  id: string
  name: string
  finCode?: string
}

interface LeaveRequestWizardProps {
  /** Pre-known employee — opened from that employee's own Leave tab. When
   * given, the Employee step never renders and the wizard starts directly
   * at Leave Type, per "don't ask for the employee again". */
  employee?: { id: string; name: string }
  /** Only needed when `employee` isn't pre-known (opened from the Leave
   * Dashboard's "Yeni Məzuniyyət" button) — the searchable list the new
   * Employee step picks from. */
  employeeOptions?: LeaveRequestEmployeeOption[]
  leaveTypes: LeaveType[]
  onSuccess: () => void
  onClose: () => void
}

/**
 * Three steps when the employee isn't already known (Employee, Details,
 * Review), two when it is (Details, Review) — Phase 3B's original scope.
 * Details bundles Leave Type + Start Date + Number of Days + Reason in one
 * panel rather than splitting each into its own step; that keeps this
 * change additive (reusing LeaveRequestDetailsStep exactly as it already
 * works from the Employee Profile) instead of restructuring a step that
 * already works. Review & Submit still lets the existing Leave Policy
 * Resolution / Balance engines calculate everything else via
 * previewLeaveRequestAction, never recomputed here. Submission goes
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
export function LeaveRequestWizard({
  employee,
  employeeOptions,
  leaveTypes,
  onSuccess,
  onClose,
}: LeaveRequestWizardProps) {
  const t = useTranslations("Employees.leaveRequest")
  const tLeave = useTranslations("Employees.profile.leave")
  const locale = useLocale()
  const stepKeys: StepKey[] = employee ? ["details", "review"] : ["employee", "details", "review"]
  const employeeStepIndex = stepKeys.indexOf("employee")
  const detailsStepIndex = stepKeys.indexOf("details")
  const reviewStepIndex = stepKeys.indexOf("review")

  const [stepIndex, setStepIndex] = useState(0)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employee?.id ?? "")
  const [employeeError, setEmployeeError] = useState<string | null>(null)
  const [details, setDetails] = useState<LeaveRequestDetailsData>(emptyDetails)
  const [errors, setErrors] = useState<Partial<Record<keyof LeaveRequestDetailsData, string>>>({})
  const [evaluation, setEvaluation] = useState<LeaveRequestEvaluation | null>(null)
  const [paymentSummary, setPaymentSummary] = useState<LeavePaymentSummary | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  const steps = stepKeys.map((key) => ({ key, label: t(`steps.${key}`) }))
  const leaveType = leaveTypes.find((lt) => lt.id === details.leaveTypeId)
  const selectedEmployeeName = employee?.name ?? employeeOptions?.find((e) => e.id === selectedEmployeeId)?.name ?? ""

  function patch(update: Partial<LeaveRequestDetailsData>) {
    setDetails((prev) => ({ ...prev, ...update }))
  }

  function validateDetails(): boolean {
    const nextErrors: Partial<Record<keyof LeaveRequestDetailsData, string>> = {}
    if (!details.leaveTypeId) nextErrors.leaveTypeId = t("validation.required")
    if (!details.leavePeriodStartYear) nextErrors.leavePeriodStartYear = t("validation.required")
    if (!details.startDate) nextErrors.startDate = t("validation.required")
    const numberOfDays = Number(details.numberOfDays)
    if (!details.numberOfDays || !Number.isFinite(numberOfDays) || numberOfDays <= 0) {
      nextErrors.numberOfDays = t("validation.required")
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleEmployeeNext() {
    if (!selectedEmployeeId) {
      setEmployeeError(t("validation.required"))
      return
    }
    setEmployeeError(null)
    setSubmitError(null)
    setStepIndex((i) => i + 1)
  }

  function handleDetailsNext() {
    if (!validateDetails()) return
    setSubmitError(null)
    startTransition(async () => {
      const numberOfDays = Number(details.numberOfDays)
      const leavePeriodStartYear = Number(details.leavePeriodStartYear)
      const [result, payment] = await Promise.all([
        previewLeaveRequestAction(
          selectedEmployeeId,
          details.leaveTypeId,
          details.startDate,
          numberOfDays,
          leavePeriodStartYear
        ),
        // Read-only, unrelated to whether the preview itself succeeds — the
        // Review step already renders a "pending" placeholder for any field
        // this can't estimate yet, so it doesn't gate the Next transition.
        getLeavePaymentSummaryAction(selectedEmployeeId, numberOfDays),
      ])
      setPaymentSummary(payment)
      if (result.success && result.data) {
        setEvaluation(result.data)
        setStepIndex((i) => i + 1)
      } else {
        setSubmitError(result.error ?? t("review.submitError"))
      }
    })
  }

  function handleNext() {
    if (stepIndex === employeeStepIndex) handleEmployeeNext()
    else if (stepIndex === detailsStepIndex) handleDetailsNext()
  }

  function handleBack() {
    setSubmitError(null)
    setStepIndex((i) => Math.max(0, i - 1))
  }

  function handleSubmit() {
    setSubmitError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set("employeeId", selectedEmployeeId)
      formData.set("leaveTypeId", details.leaveTypeId)
      formData.set("startDate", details.startDate)
      formData.set("numberOfDays", details.numberOfDays)
      formData.set("leavePeriodStartYear", details.leavePeriodStartYear)
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
  const unit = leaveType?.unit ?? "DAYS"

  function formatFooterCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Stepper lives in its own sticky strip, outside the scrollable
       * region below — on a tall step (Review, with five summary cards) it
       * used to scroll out of view along with the content; now it stays put
       * the same way the header above and the footer below already did. */}
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-border px-6 py-3">
        <Stepper steps={steps} currentIndex={stepIndex} />
        <div className="flex flex-col gap-1.5 lg:hidden">
          <span className="text-sm text-muted-foreground">
            {t("stepIndicator", { current: stepIndex + 1, total: steps.length })}
          </span>
          <Progress value={((stepIndex + 1) / steps.length) * 100} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex flex-col gap-4">
          {submitError ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          {/* Capped to a readable form width rather than stretching to the
           * modal's full 90vw — the modal itself stays large (see
           * leave-request-wizard-modal.tsx), only the form content inside
           * it is narrowed to a professional, centered column. */}
          <div className="mx-auto w-full max-w-3xl">
            {stepIndex === employeeStepIndex ? (
              <Card>
                <CardContent>
                  <Field
                    label={t("employeeStep.label")}
                    htmlFor="employeeId"
                    required
                    error={employeeError ?? undefined}
                  >
                    <SearchableSelect
                      id="employeeId"
                      value={selectedEmployeeId}
                      onValueChange={setSelectedEmployeeId}
                      options={(employeeOptions ?? []).map((option) => ({
                        value: option.id,
                        label: option.name,
                        // Department is no longer a search criterion, so it
                        // no longer appears here either — FIN + Employee ID
                        // instead, matching what's actually searchable.
                        hint: option.finCode ? `FIN: ${option.finCode} | ${option.id}` : option.id,
                        // Matches on name (first/last/full — a substring
                        // search over the full name already covers all
                        // three), Employee ID, and FIN — never department.
                        searchValue: [option.name, option.id, option.finCode].filter(Boolean).join(" "),
                      }))}
                      placeholder={t("employeeStep.placeholder")}
                      searchPlaceholder={t("employeeStep.searchPlaceholder")}
                      emptyText={t("employeeStep.emptyText")}
                    />
                  </Field>
                </CardContent>
              </Card>
            ) : null}
            {stepIndex === detailsStepIndex ? (
              <Card>
                <CardContent>
                  <LeaveRequestDetailsStep data={details} onChange={patch} leaveTypes={leaveTypes} errors={errors} />
                </CardContent>
              </Card>
            ) : null}
            {stepIndex === reviewStepIndex && evaluation ? (
              <LeaveRequestReviewStep
                evaluation={evaluation}
                employeeName={selectedEmployeeName}
                leaveTypeName={leaveType?.name ?? ""}
                leavePeriodStartYear={details.leavePeriodStartYear}
                unit={unit}
                payment={paymentSummary}
                file={file}
                onFileChange={setFile}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
        <Button variant="outline" onClick={handleBack} disabled={stepIndex === 0 || isPending}>
          <ChevronLeft className="size-4" strokeWidth={1.75} />
          {t("back")}
        </Button>

        <div className="flex items-center gap-4">
          {/* Requested Days / Gross Payment readout — the same two numbers
           * the Review step's own cards already show, surfaced here too so
           * they're never scrolled out of view right before Submit. Only
           * meaningful once the Review step has both fetches loaded — the
           * Employee/Details steps never reach this branch. */}
          {isLastStep && evaluation && paymentSummary ? (
            <div className="hidden items-center gap-4 sm:flex">
              <div className="flex flex-col items-end">
                <span className="text-xs text-muted-foreground">{t("review.paymentLeaveDays")}</span>
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {formatLeaveUnitAmount(tLeave, evaluation.numberOfDays, unit)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-muted-foreground">{t("review.paymentGrossAmount")}</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {paymentSummary.grossAmount === null
                    ? t("review.paymentPending")
                    : formatFooterCurrency(paymentSummary.grossAmount, paymentSummary.currency)}
                </span>
              </div>
            </div>
          ) : null}

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
    </div>
  )
}
