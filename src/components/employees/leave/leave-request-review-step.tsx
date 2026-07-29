"use client"

import { useTranslations } from "next-intl"
import { AlertTriangle, CheckCircle2, Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Field } from "@/components/common/field"
import { FileDropzone } from "@/components/common/file-dropzone"
import type { LeaveRequestEvaluation } from "@/lib/leave/leave-request-service"

interface LeaveRequestReviewStepProps {
  evaluation: LeaveRequestEvaluation
  leaveTypeName: string
  unit: "DAYS" | "HOURS"
  file: File | null
  onFileChange: (file: File | null) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

export function LeaveRequestReviewStep({
  evaluation,
  leaveTypeName,
  unit,
  file,
  onFileChange,
}: LeaveRequestReviewStepProps) {
  const t = useTranslations("Employees.leaveRequest.review")
  const tLeave = useTranslations("Employees.profile.leave")
  const { returnToWork, eligibility, balance, balanceValidationMode, isBalanceSufficient } = evaluation

  function formatUnitAmount(value: number): string {
    return unit === "HOURS" ? tLeave("hours", { count: value }) : tLeave("days", { count: value })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label={t("leaveType")}>
          <p className="text-sm font-medium text-foreground">{leaveTypeName}</p>
        </Field>
        <Field label={t("endDate")}>
          <p className="text-sm font-medium text-foreground tabular-nums">{formatDate(returnToWork.lastLeaveDay)}</p>
        </Field>
        <Field label={t("returnToWorkDate")}>
          <p className="text-sm font-medium text-foreground tabular-nums">
            {formatDate(returnToWork.returnToWorkDate)}
          </p>
        </Field>
        <Field label={t("calendarDays")}>
          <p className="text-sm font-medium text-foreground tabular-nums">{returnToWork.calendarDays}</p>
        </Field>
      </div>

      <Field label={t("holidaysInRange")}>
        <p className="text-sm text-foreground">
          {returnToWork.holidaysInRange.length > 0
            ? returnToWork.holidaysInRange.map(formatDate).join(", ")
            : t("noHolidays")}
        </p>
      </Field>

      {returnToWork.startDateWarning ? (
        <Alert>
          <Info />
          <AlertTitle>{t("startDateWarningTitle")}</AlertTitle>
          <AlertDescription>
            {returnToWork.startDateWarning.isHoliday
              ? t("startDateWarningHoliday")
              : t("startDateWarningNonWorking")}
          </AlertDescription>
        </Alert>
      ) : null}

      {eligibility.requiresWarning ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>{t("eligibilityWarningTitle")}</AlertTitle>
          <AlertDescription>
            {t("eligibilityWarning", {
              date: formatDate(eligibility.eligibilityDate),
              count: eligibility.remainingDays,
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      <Alert variant={!isBalanceSufficient && balanceValidationMode === "BLOCK" ? "destructive" : undefined}>
        {isBalanceSufficient ? <CheckCircle2 /> : <AlertTriangle />}
        <AlertTitle>{t("balance")}</AlertTitle>
        <AlertDescription>
          {t("balanceRemaining", { remaining: formatUnitAmount(balance.remaining) })}
          {" — "}
          {isBalanceSufficient
            ? t("balanceSufficient")
            : balanceValidationMode === "BLOCK"
              ? t("balanceBlocked")
              : t("balanceWarning")}
        </AlertDescription>
      </Alert>

      <Field label={t("attachment")} hint={t("attachmentHint")}>
        <FileDropzone
          label={file ? file.name : t("attachment")}
          hint={t("attachmentHint")}
          accept="application/pdf,image/jpeg,image/png"
          onFiles={(files) => onFileChange(files[0] ?? null)}
        />
      </Field>
    </div>
  )
}
