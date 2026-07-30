"use client"

import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useTranslations } from "next-intl"
import { CalendarClock } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DataTable } from "@/components/common/data-table"
import { LeaveRequestStatusBadge } from "@/components/leave/leave-request-status-badge"
import { formatLeaveUnitAmount } from "@/lib/leave/leave-unit-format"
import { formatLeaveDate } from "@/lib/leave/leave-date-format"
import type { LeaveRequestLifecycleStatus, LeaveUnit } from "@/generated/prisma/enums"

/**
 * A plain, pre-resolved view model — not EmployeeProfile itself. The
 * employeeId -> name/department lookup happens once, server-side, in
 * page.tsx (which can safely import the in-memory employee directory);
 * shipping that whole directory into this client component's bundle just
 * to resolve a few dozen names would be wasteful. Same reasoning
 * EmployeeListItem already applies to the Employee List.
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
  status: LeaveRequestLifecycleStatus
}

interface LeaveRequestsTableProps {
  rows: LeaveRequestRow[]
}

/**
 * The HR-facing, cross-employee counterpart to the Employee Profile Leave
 * tab's own request list — same LeaveRequest data (via
 * getAllLeaveRequestsAction, the org-wide sibling of that tab's
 * getLeaveRequestsForEmployeeAction), same status badge
 * (LeaveRequestStatusBadge) and unit formatting (formatLeaveUnitAmount) as
 * the tab, rendered as a table instead of a per-employee list. Clicking a
 * row deep-links into that employee's own Leave tab (?tab=leave) rather
 * than duplicating the balance/history detail here.
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
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{row.original.employeeName}</span>
              <span className="text-xs text-muted-foreground">{row.original.employeeDepartment}</span>
            </div>
          </Link>
        ),
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
        id: "units",
        header: t("units"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums text-foreground">
            {formatLeaveUnitAmount(tUnit, row.original.requestedUnits, row.original.unit)}
          </span>
        ),
      },
      {
        id: "status",
        header: t("status"),
        cell: ({ row }) => <LeaveRequestStatusBadge status={row.original.status} />,
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
