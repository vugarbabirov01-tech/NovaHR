"use client"

import { useEffect, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Stepper } from "@/components/common/stepper"
import { TerminationInfoStep } from "@/components/employees/termination/termination-info-step"
import { AssetReturnStep } from "@/components/employees/termination/asset-return-step"
import { LeaveBalanceStep } from "@/components/employees/termination/leave-balance-step"
import { FinalPayrollStep } from "@/components/employees/termination/final-payroll-step"
import { OffboardingChecklistStep } from "@/components/employees/termination/offboarding-checklist-step"
import { TerminationReviewStep } from "@/components/employees/termination/termination-review-step"
import { validateTerminationInfoStep, type TerminationValidationErrors } from "@/lib/termination/validation"
import {
  getAssignedAssetsAction,
  getFinalSettlementSummaryAction,
  getLeaveBalanceAction,
  terminateEmployeeAction,
} from "@/lib/termination/actions"
import { defaultTerminationWizardData, type TerminationWizardData } from "@/types/termination-wizard"
import type { AssetAssignment } from "@/types/integrations/asset-management"
import type { LeaveBalanceSummary } from "@/types/integrations/leave"
import type { PayrollSettlementItem } from "@/types/integrations/payroll"
import type { EmployeeProfile } from "@/types/employee-profile"
import { getFullName } from "@/lib/employees"

const stepKeys = ["info", "assets", "leave", "payroll", "checklist", "review"] as const

interface TerminationWizardProps {
  employeeId: string
  profile: EmployeeProfile
  onSuccess: () => void
  onClose: () => void
}

export function TerminationWizard({ employeeId, profile, onSuccess, onClose }: TerminationWizardProps) {
  const t = useTranslations("Employees.termination")
  const [stepIndex, setStepIndex] = useState(0)
  const [data, setData] = useState<TerminationWizardData>(defaultTerminationWizardData)
  const [errors, setErrors] = useState<TerminationValidationErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDone, setIsDone] = useState(false)

  const [assets, setAssets] = useState<AssetAssignment[]>([])
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalanceSummary | null>(null)
  const [payrollSummary, setPayrollSummary] = useState<PayrollSettlementItem[]>([])
  const [isLoadingContext, setIsLoadingContext] = useState(true)

  // The wizard fetches everything Steps 2-4 need once, up front — Asset,
  // Leave and Payroll are separate modules Termination only ever reaches
  // through their provider actions, never through employee-directory
  // directly.
  useEffect(() => {
    let cancelled = false

    async function load() {
      const [assignedAssets, leave] = await Promise.all([
        getAssignedAssetsAction(employeeId),
        getLeaveBalanceAction(employeeId),
      ])
      const outstandingAssetCount = assignedAssets.filter((asset) => asset.status === "assigned").length
      const summary = await getFinalSettlementSummaryAction(employeeId, {
        unusedLeaveDays: leave?.remainingLeave ?? 0,
        outstandingAssetCount,
      })
      if (cancelled) return
      setAssets(assignedAssets)
      setLeaveBalance(leave)
      setPayrollSummary(summary)
      setIsLoadingContext(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [employeeId])

  const steps = stepKeys.map((key) => ({ key, label: t(`steps.${key}`) }))
  const isLastStep = stepIndex === steps.length - 1

  function patch(update: Partial<TerminationWizardData>) {
    setData((prev) => ({ ...prev, ...update }))
  }

  function goToStep(index: number) {
    setStepIndex(index)
    setSubmitError(null)
  }

  function handleNext() {
    if (stepIndex === 0) {
      const stepErrors = validateTerminationInfoStep(data, { required: t("validation.required") })
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors)
        return
      }
    }
    setErrors({})
    goToStep(Math.min(steps.length - 1, stepIndex + 1))
  }

  function handleBack() {
    setErrors({})
    goToStep(Math.max(0, stepIndex - 1))
  }

  const outstandingAssetCount = assets.filter(
    (asset) => (data.assetReturns[asset.id] ?? asset.status) !== "returned"
  ).length
  const checklistValues = Object.values(data.checklist)
  const checklistCompletionPercent = Math.round(
    (checklistValues.filter(Boolean).length / checklistValues.length) * 100
  )

  function handleSubmit() {
    setSubmitError(null)
    startTransition(async () => {
      const result = await terminateEmployeeAction(employeeId, {
        terminationDate: data.terminationDate,
        lastWorkingDay: data.lastWorkingDay,
        reason: data.reason || "other",
        labourCodeArticle: data.labourCodeArticle || undefined,
        notes: data.notes || undefined,
        assetReturns: Object.entries(data.assetReturns).map(([assetId, status]) => ({ assetId, status })),
        checklist: data.checklist,
      })
      if (result.success) {
        setIsDone(true)
        onSuccess()
      } else {
        setSubmitError(t("validation.saveFailed"))
      }
    })
  }

  if (isDone) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-status-good/10">
            <CheckCircle2 className="size-6 text-status-good" strokeWidth={1.75} />
          </div>
          <h2 className="font-heading text-lg font-semibold text-foreground">{t("successTitle")}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{t("successDescription")}</p>
          <Button variant="outline" onClick={onClose} className="mt-2">
            {t("close")}
          </Button>
        </CardContent>
      </Card>
    )
  }

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
          {stepIndex === 0 ? <TerminationInfoStep data={data} onChange={patch} errors={errors} /> : null}
          {stepIndex === 1 ? (
            <AssetReturnStep
              assets={assets}
              value={data.assetReturns}
              onChange={(assetReturns) => patch({ assetReturns })}
              isLoading={isLoadingContext}
            />
          ) : null}
          {stepIndex === 2 ? <LeaveBalanceStep leaveBalance={leaveBalance} isLoading={isLoadingContext} /> : null}
          {stepIndex === 3 ? <FinalPayrollStep items={payrollSummary} isLoading={isLoadingContext} /> : null}
          {stepIndex === 4 ? (
            <OffboardingChecklistStep
              checklist={data.checklist}
              onChange={(checklist) => patch({ checklist })}
            />
          ) : null}
          {stepIndex === 5 ? (
            <TerminationReviewStep
              employeeName={getFullName(profile.personal)}
              department={profile.employment.department}
              position={profile.employment.position}
              data={data}
              outstandingAssetCount={outstandingAssetCount}
              leaveBalance={leaveBalance}
              payrollSummary={payrollSummary}
              checklistCompletionPercent={checklistCompletionPercent}
            />
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} disabled={stepIndex === 0 || isPending}>
          <ChevronLeft className="size-4" strokeWidth={1.75} />
          {t("back")}
        </Button>

        {isLastStep ? (
          <Button variant="destructive" onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {t("finish")}
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
