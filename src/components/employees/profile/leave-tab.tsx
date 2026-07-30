"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { CalendarCheck, CalendarClock, CalendarMinus, CalendarPlus, Loader2 } from "lucide-react"

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

      {leaveTypes.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={CalendarClock} title={t("noLeaveTypes")} description={t("noLeaveTypesDescription")} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {summary.map((balance) => {
            const leaveType = leaveTypeById.get(balance.leaveTypeId)
            const unit = leaveType?.unit ?? "DAYS"
            return (
              <Card key={balance.leaveTypeId}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {leaveType?.name ?? balance.leaveTypeId}
                  </CardTitle>
                </CardHeader>
                {/* Same KpiCard used on the Leave Dashboard (LeaveSummarySection)
                 * — identical sizing, spacing, typography, icons, and
                 * tooltips, per-leave-type instead of org-wide. */}
                <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <KpiCard
                    label={t("openingBalance")}
                    tooltip={tTooltips("openingBalance", { year: currentYear })}
                    value={formatLeaveUnitAmount(t, balance.opening, unit)}
                    icon={CalendarPlus}
                  />
                  <KpiCard
                    label={t("carriedForward")}
                    tooltip={tTooltips("carriedForward")}
                    value={formatLeaveUnitAmount(t, balance.carriedForward, unit)}
                    icon={CalendarClock}
                  />
                  <KpiCard
                    label={t("taken")}
                    tooltip={tTooltips("taken")}
                    value={formatLeaveUnitAmount(t, balance.taken, unit)}
                    icon={CalendarMinus}
                  />
                  <KpiCard
                    label={t("remaining")}
                    tooltip={tTooltips("remaining")}
                    value={formatLeaveUnitAmount(t, balance.remaining, unit)}
                    icon={CalendarCheck}
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
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
          profile={profile}
          leaveTypes={leaveTypes}
          onSuccess={handleWizardSuccess}
        />
      ) : null}
    </div>
  )
}
