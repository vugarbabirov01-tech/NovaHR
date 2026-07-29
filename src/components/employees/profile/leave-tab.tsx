"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { CalendarClock, CalendarPlus, Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import {
  getActiveLeaveTypesAction,
  getEmployeeLeaveSummaryAction,
  getLeaveTransactionHistoryAction,
} from "@/lib/leave/leave-balance-actions"
import { getLeaveRequestsForEmployeeAction } from "@/lib/leave/leave-request-actions"
import type { LeaveBalanceStatement } from "@/types/leave"
import type { LeaveType } from "@/repositories/leave-type-repository"
import type { LeaveLedgerEntry } from "@/repositories/leave-ledger-repository"
import type { LeaveRequest } from "@/repositories/leave-request-repository"
import type { EmployeeProfile } from "@/types/employee-profile"

interface LeaveTabProps {
  profile: EmployeeProfile
}

const requestStatusMessageKeys: Record<string, string> = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  PENDING_APPROVAL: "pendingApproval",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  WITHDRAWN: "withdrawn",
}

const requestStatusBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  SUBMITTED: "secondary",
  PENDING_APPROVAL: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "outline",
  WITHDRAWN: "outline",
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
  const tEntryTypes = useTranslations("Employees.profile.leave.entryTypes")
  const tRequestStatus = useTranslations("Employees.profile.leave.requestStatus")
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

  function formatUnitAmount(value: number, unit: "DAYS" | "HOURS"): string {
    return unit === "HOURS" ? t("hours", { count: value }) : t("days", { count: value })
  }

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
        <Button size="sm" onClick={() => setIsWizardOpen(true)} disabled={leaveTypes.length === 0}>
          <CalendarPlus className="size-4" strokeWidth={1.75} />
          {t("requestLeave")}
        </Button>
      </div>

      {leaveTypes.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={CalendarClock} title={t("noLeaveTypes")} />
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
                <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: t("openingBalance"), value: balance.opening },
                    { label: t("carriedForward"), value: balance.carriedForward },
                    { label: t("taken"), value: balance.taken },
                    { label: t("remaining"), value: balance.remaining },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-heading text-lg font-semibold text-foreground tabular-nums">
                        {formatUnitAmount(item.value, unit)}
                      </p>
                    </div>
                  ))}
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
                        <Badge variant={requestStatusBadgeVariant[request.status] ?? "outline"}>
                          {tRequestStatus(requestStatusMessageKeys[request.status] ?? "pendingApproval")}
                        </Badge>
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
                        {formatUnitAmount(request.requestedUnits, unit)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {new Date(request.startDate).toLocaleDateString()} –{" "}
                        {new Date(request.endDate).toLocaleDateString()}
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
                      {formatUnitAmount(entry.amount, entry.unit)}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(entry.effectiveDate).toLocaleDateString()}
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
