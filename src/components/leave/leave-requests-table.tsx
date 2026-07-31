"use client"

import { useMemo, useState, useTransition } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useTranslations } from "next-intl"
import { CalendarClock, Check, Eye, Loader2, X, XCircle } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/common/data-table"
import { LeaveRequestStatusBadge } from "@/components/leave/leave-request-status-badge"
import {
  approveLeaveRequestAction,
  cancelLeaveRequestAction,
  rejectLeaveRequestAction,
} from "@/lib/leave/leave-request-actions"
import { formatLeaveUnitAmount } from "@/lib/leave/leave-unit-format"
import { formatLeaveDate } from "@/lib/leave/leave-date-format"
import type { LeaveRequestLifecycleStatus, LeaveUnit } from "@/generated/prisma/enums"

/**
 * A plain, pre-resolved view model — not EmployeeProfile itself. The
 * employeeId -> name/department lookup happens once, server-side, in
 * page.tsx (which can safely import the in-memory employee directory);
 * shipping that whole directory into this client component's bundle just
 * to resolve a few dozen names would be wasteful. Same reasoning
 * EmployeeListItem already applies to the Employee List. workingDays,
 * requestedBy, and approvalLevel are likewise resolved server-side —
 * workingDays via the same Leave Policy Resolution engine the request
 * wizard uses (calculateReturnToWork), never recomputed here.
 */
export interface LeaveRequestRow {
  id: string
  employeeId: string
  employeeName: string
  employeeInitials: string
  employeeDepartment: string
  leaveTypeName: string
  unit: LeaveUnit
  startDate: string
  endDate: string
  requestedUnits: number
  workingDays: number
  status: LeaveRequestLifecycleStatus
  requestedBy: string
  approvalLevel: string
}

interface LeaveRequestsTableProps {
  rows: LeaveRequestRow[]
}

type DecisionResult = { success: boolean; error?: string }

/**
 * View/Approve/Reject/Cancel for a row — the interactive bit that makes
 * this table an actual HR approval queue rather than a read-only list.
 * Approve/Reject only for PENDING_APPROVAL; Cancel for anything still
 * PENDING_APPROVAL or already APPROVED (cancelLeaveRequestAction's own
 * validation — see leave-request-decision-service.ts). Calls Server
 * Actions directly; each one calls revalidatePath server-side, so a
 * successful decision refreshes this table's rows (and every other Leave
 * balance surface) without any client-side refetch code here.
 */
function RequestRowActions({ row }: { row: LeaveRequestRow }) {
  const t = useTranslations("Leave.dashboard.table")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function decide(action: (id: string) => Promise<DecisionResult>) {
    setError(null)
    startTransition(async () => {
      const result = await action(row.id)
      if (!result.success) setError(result.error ?? t("decisionError"))
    })
  }

  const canDecide = row.status === "PENDING_APPROVAL"
  const canCancel = row.status === "PENDING_APPROVAL" || row.status === "APPROVED"

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("view")}
          nativeButton={false}
          render={<Link href={`/employees/${row.employeeId}?tab=leave`} />}
        >
          <Eye className="size-4 text-muted-foreground" strokeWidth={1.75} />
        </Button>
        {canDecide ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("approve")}
              disabled={isPending}
              onClick={() => decide(approveLeaveRequestAction)}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <Check className="size-4 text-status-good" strokeWidth={1.75} />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("reject")}
              disabled={isPending}
              onClick={() => decide((id) => rejectLeaveRequestAction(id))}
            >
              <X className="size-4 text-status-critical" strokeWidth={1.75} />
            </Button>
          </>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("cancel")}
            disabled={isPending}
            onClick={() => decide((id) => cancelLeaveRequestAction(id))}
          >
            <XCircle className="size-4 text-muted-foreground" strokeWidth={1.75} />
          </Button>
        ) : null}
      </div>
      {error ? <span className="text-xs text-status-critical">{error}</span> : null}
    </div>
  )
}

/**
 * The HR-facing, cross-employee counterpart to the Employee Profile Leave
 * tab's own request list — same LeaveRequest data (via
 * getAllLeaveRequestsAction, the org-wide sibling of that tab's
 * getLeaveRequestsForEmployeeAction), same status badge
 * (LeaveRequestStatusBadge) and unit formatting (formatLeaveUnitAmount) as
 * the tab, rendered as a table instead of a per-employee list. This is the
 * Leave Dashboard's approval queue: every row exposes View, and Approve/
 * Reject/Cancel where the request's current status permits them.
 */
export function LeaveRequestsTable({ rows }: LeaveRequestsTableProps) {
  const t = useTranslations("Leave.dashboard.table")
  const tUnit = useTranslations("Employees.profile.leave")
  const tCommon = useTranslations("Common")
  const monthsShort = tCommon.raw("monthsShort") as string[]

  const columns: ColumnDef<LeaveRequestRow>[] = useMemo(
    () => [
      {
        id: "employee",
        header: t("employee"),
        cell: ({ row }) => (
          <Link
            href={`/employees/${row.original.employeeId}?tab=leave`}
            className="flex items-center gap-3 hover:underline"
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-accent text-accent-foreground text-[11px]">
                {row.original.employeeInitials}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-foreground">{row.original.employeeName}</span>
          </Link>
        ),
      },
      {
        id: "department",
        header: t("department"),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.employeeDepartment}</span>,
      },
      {
        id: "leaveType",
        header: t("leaveType"),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.leaveTypeName}</span>,
      },
      {
        id: "dates",
        header: t("dates"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatLeaveDate(row.original.startDate, monthsShort)} – {formatLeaveDate(row.original.endDate, monthsShort)}
          </span>
        ),
      },
      {
        id: "workingDays",
        header: t("workingDays"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums text-foreground">
            {formatLeaveUnitAmount(tUnit, row.original.workingDays, row.original.unit)}
          </span>
        ),
      },
      {
        id: "status",
        header: t("status"),
        cell: ({ row }) => <LeaveRequestStatusBadge status={row.original.status} />,
      },
      {
        id: "requestedBy",
        header: t("requestedBy"),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.requestedBy}</span>,
      },
      {
        id: "approvalLevel",
        header: t("approvalLevel"),
        cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.approvalLevel}</span>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <RequestRowActions row={row.original} />,
      },
    ],
    [t, tUnit, monthsShort]
  )

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyIcon={CalendarClock}
      emptyTitle={t("emptyTitle")}
      emptyDescription={t("emptyDescription")}
    />
  )
}
