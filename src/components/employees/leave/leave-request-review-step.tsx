"use client"

import { useTranslations } from "next-intl"
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileDropzone } from "@/components/common/file-dropzone"
import { InfoTooltip } from "@/components/common/info-tooltip"
import { LeavePaymentSummary } from "@/components/employees/leave/leave-payment-summary"
import { formatLeaveUnitAmount } from "@/lib/leave/leave-unit-format"
import { formatLeaveDate } from "@/lib/leave/leave-date-format"
import { cn } from "@/lib/utils"
import type { LeaveRequestEvaluation } from "@/lib/leave/leave-request-service"
import type { LeavePaymentSummary as LeavePaymentSummaryData } from "@/types/integrations/payroll"

interface LeaveRequestReviewStepProps {
  evaluation: LeaveRequestEvaluation
  employeeName: string
  leaveTypeName: string
  unit: "DAYS" | "HOURS"
  /** Fetched once alongside `evaluation` (see leave-request-wizard.tsx) from
   * the Payroll integration provider — null only for the brief window before
   * that fetch resolves. */
  payment: LeavePaymentSummaryData | null
  file: File | null
  onFileChange: (file: File | null) => void
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

function BalanceFlowNode({
  label,
  tooltip,
  value,
  emphasize,
  tone,
}: {
  label: string
  tooltip?: string
  value: string
  emphasize?: boolean
  tone?: "good" | "critical"
}) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {tooltip ? <InfoTooltip content={tooltip} /> : null}
      </div>
      <span
        className={cn(
          "font-heading tabular-nums text-foreground",
          emphasize ? "text-3xl font-semibold tracking-tight" : "text-lg font-medium",
          tone === "good" && "text-status-good",
          tone === "critical" && "text-status-critical"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function FlowArrow() {
  return (
    <ArrowRight
      className="size-4 shrink-0 rotate-90 text-muted-foreground sm:rotate-0"
      strokeWidth={1.75}
    />
  )
}

function ChecklistItem({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-status-good" strokeWidth={1.75} />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-critical" strokeWidth={1.75} />
      )}
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-foreground">{label}</span>
        {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
      </div>
    </div>
  )
}

/**
 * An executive summary before submission, not a long form — five compact
 * cards read top to bottom: who/what/when, the balance flow, the payment
 * estimate, one merged validation checklist, then the optional attachment.
 * Every number here is still exactly what evaluateLeaveRequest computed;
 * only how it's grouped and styled changed. See leave-request-wizard.tsx for
 * the sticky header/stepper/footer shell this renders inside of.
 */
export function LeaveRequestReviewStep({
  evaluation,
  employeeName,
  leaveTypeName,
  unit,
  payment,
  file,
  onFileChange,
}: LeaveRequestReviewStepProps) {
  const t = useTranslations("Employees.leaveRequest.review")
  const tDetails = useTranslations("Employees.leaveRequest.details")
  const tLeave = useTranslations("Employees.profile.leave")
  const tTooltips = useTranslations("Employees.profile.leave.tooltips")
  const tCommon = useTranslations("Common")
  const monthsShort = tCommon.raw("monthsShort") as string[]
  const currentYear = new Date().getFullYear()
  const { returnToWork, eligibility, balance, balanceValidationMode, isBalanceSufficient } = evaluation
  // Forward-looking, not a stored figure — what balance.remaining will
  // become once this specific request (numberOfDays) is approved. Balance
  // itself is already scoped to this employee/leaveType/startDate (see
  // evaluateLeaveRequest), so this is the one number nothing upstream
  // computes yet.
  const remainingAfterApproval = balance.remaining - evaluation.numberOfDays

  function formatUnitAmount(value: number): string {
    return formatLeaveUnitAmount(tLeave, value, unit)
  }

  function formatDate(iso: string): string {
    return formatLeaveDate(iso, monthsShort)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Leave Summary — employee + leave type read first like a header,
       * dates/day-counts are one compact row, holidays only appear when
       * there are any. Replaces the old 8-field flat grid. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("generalInfoTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{t("employee")}</span>
              <span className="text-base font-semibold text-foreground">{employeeName}</span>
            </div>
            <Badge variant="secondary">{leaveTypeName}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryStat label={t("startDate")} value={formatDate(returnToWork.startDate)} />
            <SummaryStat label={t("endDate")} value={formatDate(returnToWork.lastLeaveDay)} />
            <SummaryStat label={t("returnToWorkDate")} value={formatDate(returnToWork.returnToWorkDate)} />
            <SummaryStat label={t("calendarDays")} value={String(returnToWork.calendarDays)} />
            <SummaryStat label={t("workingDays")} value={String(returnToWork.workingDaysInRange)} />
          </div>

          {returnToWork.holidaysInRange.length > 0 ? (
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              {t("holidaysInRange")}: {returnToWork.holidaysInRange.map(formatDate).join(", ")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* 2. Leave Balance — a flow (entitlement -> used -> requested ->
       * remaining) instead of five identical stat tiles. Same balance
       * numbers as before; Remaining gets the strongest emphasis since it's
       * the one figure that answers "can this be approved". */}
      <Card>
        <CardHeader>
          <CardTitle>{t("balanceSectionTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <BalanceFlowNode
              label={tLeave("openingBalance")}
              tooltip={tTooltips("openingBalance", { year: currentYear })}
              value={formatUnitAmount(balance.opening)}
            />
            <FlowArrow />
            <BalanceFlowNode
              label={tLeave("taken")}
              tooltip={tTooltips("taken")}
              value={formatUnitAmount(balance.taken)}
            />
            <FlowArrow />
            <BalanceFlowNode label={tDetails("numberOfDays")} value={formatUnitAmount(evaluation.numberOfDays)} />
            <FlowArrow />
            <BalanceFlowNode
              label={t("remainingAfterApproval")}
              tooltip={t("remainingAfterApprovalTooltip")}
              value={formatUnitAmount(remainingAfterApproval)}
              emphasize
              tone={isBalanceSufficient ? "good" : "critical"}
            />
          </div>

          {balance.carriedForward !== 0 ? (
            <p className="text-xs text-muted-foreground">
              {tLeave("carriedForward")}: {formatUnitAmount(balance.carriedForward)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* 3. Leave Payment — UI preparation for the future Payroll
       * integration only; see leave-payment-summary.tsx's own doc comment.
       * `payment` is briefly null while the wizard's parallel fetch (see
       * leave-request-wizard.tsx) is still in flight. */}
      {payment ? <LeavePaymentSummary payment={payment} unit={unit} /> : null}

      {/* 4. Validation — one checklist instead of separate warning cards.
       * Always visible (not only when something's wrong) so HR sees an
       * explicit confirmation, not just the absence of a warning. Every
       * condition and every piece of copy here is the same one the old
       * per-alert version used. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("validationSectionTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border p-0">
          <ChecklistItem
            ok={isBalanceSufficient}
            label={t("balance")}
            detail={`${t("balanceRemaining", { remaining: formatUnitAmount(balance.remaining) })} — ${
              isBalanceSufficient
                ? t("balanceSufficient")
                : balanceValidationMode === "BLOCK"
                  ? t("balanceBlocked")
                  : t("balanceWarning")
            }`}
          />
          <ChecklistItem
            ok={!returnToWork.startDateWarning}
            label={returnToWork.startDateWarning ? t("startDateWarningTitle") : t("validationDatesValid")}
            detail={
              returnToWork.startDateWarning
                ? returnToWork.startDateWarning.isHoliday
                  ? t("startDateWarningHoliday")
                  : t("startDateWarningNonWorking")
                : undefined
            }
          />
          <ChecklistItem
            ok={!eligibility.requiresWarning}
            label={eligibility.requiresWarning ? t("eligibilityWarningTitle") : t("validationEligible")}
            detail={
              eligibility.requiresWarning
                ? t("eligibilityWarning", {
                    date: formatDate(eligibility.eligibilityDate),
                    count: eligibility.remainingDays,
                  })
                : undefined
            }
          />
        </CardContent>
      </Card>

      {/* 5. Documents — optional, so this stays one compact row rather than
       * a large empty dropzone. */}
      <Card>
        <CardContent>
          <FileDropzone
            label={file ? file.name : t("attachment")}
            hint=""
            accept="application/pdf,image/jpeg,image/png"
            onFiles={(files) => onFileChange(files[0] ?? null)}
            className="flex-row items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-left"
          />
        </CardContent>
      </Card>
    </div>
  )
}
