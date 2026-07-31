"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { CalendarCheck, CalendarClock, CalendarMinus, CalendarPlus, Hourglass, Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EmptyState } from "@/components/common/empty-state"
import { KpiCard } from "@/components/common/kpi-card"
import { LeaveRequestStatusBadge } from "@/components/leave/leave-request-status-badge"
import {
  getActiveLeaveTypesAction,
  getEmployeeLeaveSummaryAction,
  getLeaveTransactionHistoryAction,
} from "@/lib/leave/leave-balance-actions"
import { getLeaveRequestsForEmployeeAction } from "@/lib/leave/leave-request-actions"
import { formatLeaveUnitAmount } from "@/lib/leave/leave-unit-format"
import { formatLeaveDate } from "@/lib/leave/leave-date-format"
import type { LeaveBalanceStatement } from "@/types/leave"
import type { LeaveType } from "@/repositories/leave-type-repository"
import type { LeaveLedgerEntry } from "@/repositories/leave-ledger-repository"
import type { LeaveRequest } from "@/repositories/leave-request-repository"
import type { EmployeeProfile } from "@/types/employee-profile"

interface LeaveTabProps {
  profile: EmployeeProfile
}

// Same lazy-loading reasoning as EmployeeWizardModal — the wizard (and the
// FileDropzone it pulls in) is one button away from never being opened in a
// given tab visit, so it's code-split out of this tab's own bundle.
const LeaveRequestWizardModal = dynamic(
  () =>
    import("@/components/employees/leave/leave-request-wizard-modal").then(
      (mod) => mod.LeaveRequestWizardModal
    ),
  {
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
      </div>
    ),
  }
)

const entryTypeMessageKeys: Record<string, string> = {
  OPENING_BALANCE: "openingBalance",
  IMPORTED_BALANCE: "importedBalance",
  ACCRUAL: "accrual",
  CARRY_FORWARD: "carryForward",
  LEAVE_TAKEN: "leaveTaken",
  LEAVE_CANCELLED: "leaveCancelled",
  MANUAL_ADJUSTMENT: "manualAdjustment",
  EXPIRY: "expiry",
  SETTLEMENT: "settlement",
  ENCASHMENT: "encashment",
}

/**
 * Real, ledger-computed data — no more mock EmployeeProfile.leave. Fetched
 * on demand (same shape as termination-wizard.tsx's getLeaveBalanceAction
 * call) rather than prop-drilled from the profile page, since Base UI's
 * Tabs only mounts the active panel (keepMounted=false) — this tab's data
 * is never fetched unless HR actually opens it.
 */
export function LeaveTab({ profile }: LeaveTabProps) {
  const t = useTranslations("Employees.profile.leave")
  const tTooltips = useTranslations("Employees.profile.leave.tooltips")
  const tEntryTypes = useTranslations("Employees.profile.leave.entryTypes")
  const tCommon = useTranslations("Common")
  const monthsShort = tCommon.raw("monthsShort") as string[]
  const currentYear = new Date().getFullYear()
  const [isLoading, setIsLoading] = useState(true)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [summary, setSummary] = useState<LeaveBalanceStatement[]>([])
  const [history, setHistory] = useState<LeaveLedgerEntry[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  async function fetchLeaveData() {
    const [types, balances, entries, leaveRequests] = await Promise.all([
      getActiveLeaveTypesAction(),
      getEmployeeLeaveSummaryAction(profile.id),
      getLeaveTransactionHistoryAction(profile.id),
      getLeaveRequestsForEmployeeAction(profile.id),
    ])
    return { types, balances, entries, leaveRequests }
  }

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetchLeaveData().then((result) => {
      if (cancelled) return
      setLeaveTypes(result.types)
      setSummary(result.balances)
      setHistory(result.entries)
      setRequests(result.leaveRequests)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  function handleWizardSuccess() {
    setIsWizardOpen(false)
    fetchLeaveData().then((result) => {
      setLeaveTypes(result.types)
      setSummary(result.balances)
      setHistory(result.entries)
      setRequests(result.leaveRequests)
    })
  }

  const leaveTypeById = new Map(leaveTypes.map((leaveType) => [leaveType.id, leaveType]))

  // The balance summary above this tab's Requests/History sections is still
  // scoped to Annual Leave only (its own card, its own empty state below),
  // but the request wizard itself works with whatever active leave types
  // are configured — HR chooses the type when submitting, same as any other
  // leave type in the system.
  const annualLeaveType = leaveTypes.find((leaveType) => leaveType.code === "ANNUAL")
  const annualBalance = annualLeaveType
    ? summary.find((balance) => balance.leaveTypeId === annualLeaveType.id)
    : undefined

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        {leaveTypes.length === 0 ? (
          <Tooltip>
            {/* The trigger is a span, not the button itself — a disabled
             * native <button> doesn't reliably fire hover/focus events, so
             * it can't host a tooltip on its own. */}
            <TooltipTrigger render={<span tabIndex={0} className="inline-flex" />}>
              <Button size="sm" disabled>
                <CalendarPlus className="size-4" strokeWidth={1.75} />
                {t("requestLeave")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("noLeaveTypes")}</TooltipContent>
          </Tooltip>
        ) : (
          <Button size="sm" onClick={() => setIsWizardOpen(true)}>
            <CalendarPlus className="size-4" strokeWidth={1.75} />
            {t("requestLeave")}
          </Button>
        )}
      </div>

      {!annualLeaveType || !annualBalance ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={CalendarClock}
              title={t("noAnnualLeaveType")}
              description={t("noAnnualLeaveTypeDescription")}
            />
          </CardContent>
        </Card>
      ) : (
        // Annual Leave only — this tab is scoped to the employee's normal
        // annual leave balance, not every configured leave type. Full width
        // panel is what lets the metric grid below actually reach 4 columns
        // on desktop.
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{annualLeaveType.name}</CardTitle>
          </CardHeader>
          {/* Same KpiCard used on the Leave Dashboard (LeaveSummarySection)
           * — identical sizing, spacing, typography, icons, and tooltips.
           * Mobile: 1 column. Tablet (sm, 640px+): 2x2. Desktop (lg,
           * 1024px+): all 4 in one row. */}
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={t("openingBalance")}
              tooltip={tTooltips("openingBalance", { year: currentYear })}
              value={formatLeaveUnitAmount(t, annualBalance.opening, annualLeaveType.unit)}
              icon={CalendarPlus}
            />
            <KpiCard
              label={t("carriedForward")}
              tooltip={tTooltips("carriedForward")}
              value={formatLeaveUnitAmount(t, annualBalance.carriedForward, annualLeaveType.unit)}
              icon={CalendarClock}
            />
            <KpiCard
              label={t("taken")}
              tooltip={tTooltips("taken")}
              value={formatLeaveUnitAmount(t, annualBalance.taken, annualLeaveType.unit)}
              icon={CalendarMinus}
            />
            <KpiCard
              label={t("remaining")}
              tooltip={tTooltips("remaining")}
              value={formatLeaveUnitAmount(t, annualBalance.remaining, annualLeaveType.unit)}
              icon={CalendarCheck}
            />
            {/* Pending requests reserve nothing from the ledger (submitting
             * never writes a ledger entry — see submitLeaveRequestAction),
             * so Remaining above is intentionally unaffected by them. This
             * is the one place that pending total is surfaced instead, so
             * "why didn't my balance drop" has a visible answer. */}
            <KpiCard
              label={t("pending")}
              tooltip={tTooltips("pending")}
              value={formatLeaveUnitAmount(t, annualBalance.pending, annualLeaveType.unit)}
              icon={Hourglass}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("requestsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <EmptyState icon={CalendarClock} title={t("noRequests")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {requests.map((request) => {
                const leaveType = leaveTypeById.get(request.leaveTypeId)
                const unit = leaveType?.unit ?? "DAYS"
                return (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <LeaveRequestStatusBadge status={request.status} />
                        <span className="text-xs text-muted-foreground">
                          {leaveType?.name ?? request.leaveTypeId}
                        </span>
                      </div>
                      {request.reason ? (
                        <span className="text-xs text-muted-foreground">{request.reason}</span>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-sm font-medium text-foreground tabular-nums">
                        {formatLeaveUnitAmount(t, request.requestedUnits, unit)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatLeaveDate(request.startDate, monthsShort)} – {formatLeaveDate(request.endDate, monthsShort)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("leaveHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState icon={CalendarClock} title={t("noHistory")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant={entry.amount >= 0 ? "secondary" : "outline"}>
                        {tEntryTypes(entryTypeMessageKeys[entry.entryType] ?? "manualAdjustment")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {leaveTypeById.get(entry.leaveTypeId)?.name ?? entry.leaveTypeId}
                      </span>
                    </div>
                    {entry.note ? <span className="text-xs text-muted-foreground">{entry.note}</span> : null}
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-sm font-medium text-foreground tabular-nums">
                      {entry.amount >= 0 ? "+" : ""}
                      {formatLeaveUnitAmount(t, entry.amount, entry.unit)}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatLeaveDate(entry.effectiveDate, monthsShort)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {isWizardOpen ? (
        <LeaveRequestWizardModal
          open={isWizardOpen}
          onOpenChange={setIsWizardOpen}
          employee={{ id: profile.id, name: `${profile.personal.firstName} ${profile.personal.lastName}` }}
          leaveTypes={leaveTypes}
          onSuccess={handleWizardSuccess}
        />
      ) : null}
    </div>
  )
}
