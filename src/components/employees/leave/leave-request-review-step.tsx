"use client"

import { useTranslations } from "next-intl"
import { AlertTriangle, CalendarCheck, CalendarClock, CalendarMinus, CalendarPlus, CheckCircle2, Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/common/field"
import { FileDropzone } from "@/components/common/file-dropzone"
import { KpiCard } from "@/components/common/kpi-card"
import { formatLeaveUnitAmount } from "@/lib/leave/leave-unit-format"
import { formatLeaveDate } from "@/lib/leave/leave-date-format"
import type { LeaveRequestEvaluation } from "@/lib/leave/leave-request-service"

interface LeaveRequestReviewStepProps {
  evaluation: LeaveRequestEvaluation
  leaveTypeName: string
  unit: "DAYS" | "HOURS"
  file: File | null
  onFileChange: (file: File | null) => void
}

/**
 * Structured summary cards, not a cramped multi-column table — the
 * previous flat grid.grid-cols-4 layout was fine in isolation but felt
 * broken inside the old ~672px-wide Sheet (see
 * leave-request-wizard-modal.tsx's own doc comment): dates and numbers had
 * nowhere near enough room per column. Now that the wizard is a large
 * modal, this still uses sections rather than reverting to one big grid,
 * because "Ümumi məlumat" / "Məzuniyyət balansı" / "Xəbərdarlıq" /
 * "Sənədlər" are genuinely different kinds of information — grouping them
 * reads better than a flat list regardless of available width.
 *
 * No "Approval flow" section: the wizard's own author-facing brief
 * mentions Approvals as future wizard content, but Leave has no real
 * approval-routing data today (LeaveApproval is intentionally inert — see
 * leave-approval-repository.ts) — rendering a fake "Manager -> HR -> CEO"
 * chain would show information the system doesn't actually have.
 */
export function LeaveRequestReviewStep({
  evaluation,
  leaveTypeName,
  unit,
  file,
  onFileChange,
}: LeaveRequestReviewStepProps) {
  const t = useTranslations("Employees.leaveRequest.review")
  const tLeave = useTranslations("Employees.profile.leave")
  const tTooltips = useTranslations("Employees.profile.leave.tooltips")
  const tCommon = useTranslations("Common")
  const monthsShort = tCommon.raw("monthsShort") as string[]
  const currentYear = new Date().getFullYear()
  const { returnToWork, eligibility, balance, balanceValidationMode, isBalanceSufficient } = evaluation

  function formatUnitAmount(value: number): string {
    return formatLeaveUnitAmount(tLeave, value, unit)
  }

  function formatDate(iso: string): string {
    return formatLeaveDate(iso, monthsShort)
  }

  const hasWarnings = Boolean(returnToWork.startDateWarning) || eligibility.requiresWarning || !isBalanceSufficient

  return (
    <div className="flex flex-col gap-4">
      {/* Ümumi məlumat */}
      <Card>
        <CardHeader>
          <CardTitle>{t("generalInfoTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            <Field label={t("leaveType")}>
              <p className="text-sm font-medium text-foreground">{leaveTypeName}</p>
            </Field>
            <Field label={t("startDate")}>
              <p className="text-sm font-medium text-foreground tabular-nums">{formatDate(returnToWork.startDate)}</p>
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
            <Field label={t("workingDays")}>
              <p className="text-sm font-medium text-foreground tabular-nums">{returnToWork.workingDaysInRange}</p>
            </Field>
            <Field label={t("holidaysInRange")} className="col-span-2 sm:col-span-3 lg:col-span-2">
              <p className="text-sm text-foreground">
                {returnToWork.holidaysInRange.length > 0
                  ? returnToWork.holidaysInRange.map(formatDate).join(", ")
                  : t("noHolidays")}
              </p>
            </Field>
          </div>

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
        </CardContent>
      </Card>

      {/* Məzuniyyət balansı — same KpiCard, same tooltips, same terms as the
       * Employee Profile Leave tab and the Leave Dashboard. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("balanceSectionTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label={tLeave("openingBalance")}
            tooltip={tTooltips("openingBalance", { year: currentYear })}
            value={formatUnitAmount(balance.opening)}
            icon={CalendarPlus}
          />
          <KpiCard
            label={tLeave("carriedForward")}
            tooltip={tTooltips("carriedForward")}
            value={formatUnitAmount(balance.carriedForward)}
            icon={CalendarClock}
          />
          <KpiCard
            label={tLeave("taken")}
            tooltip={tTooltips("taken")}
            value={formatUnitAmount(balance.taken)}
            icon={CalendarMinus}
          />
          <KpiCard
            label={tLeave("remaining")}
            tooltip={tTooltips("remaining")}
            value={formatUnitAmount(balance.remaining)}
            icon={CalendarCheck}
          />
        </CardContent>
      </Card>

      {/* Xəbərdarlıq — only rendered when there's something to warn about. */}
      {hasWarnings ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("warningsSectionTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
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
          </CardContent>
        </Card>
      ) : null}

      {/* Sənədlər — optional, so the dropzone stays compact rather than
       * claiming a full card's worth of visual weight. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("documentsSectionTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label={t("attachment")} hint={t("attachmentHint")}>
            <FileDropzone
              label={file ? file.name : t("attachment")}
              hint={t("attachmentHint")}
              accept="application/pdf,image/jpeg,image/png"
              onFiles={(files) => onFileChange(files[0] ?? null)}
              className="gap-1.5 py-4"
            />
          </Field>
        </CardContent>
      </Card>
    </div>
  )
}
