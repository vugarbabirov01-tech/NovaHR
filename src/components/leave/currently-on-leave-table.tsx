"use client"

import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useTranslations } from "next-intl"
import { Users } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DataTable } from "@/components/common/data-table"
import { formatLeaveDate } from "@/lib/leave/leave-date-format"

/**
 * A plain, pre-resolved view model — the employeeId -> name/position/
 * department lookup happens once, server-side, in page.tsx, not by shipping
 * the employee directory into this client bundle. `daysUntilReturn` is
 * likewise resolved server-side, via the same Leave Policy Resolution
 * engine (calculateReturnToWork) the request wizard's Review step already
 * calls — never recomputed here.
 */
export interface CurrentlyOnLeaveRow {
  id: string
  employeeId: string
  employeeName: string
  employeeInitials: string
  position: string
  department: string
  leaveTypeName: string
  startDate: string
  endDate: string
  /** ReturnToWorkResult.returnToWorkDate — already adjusted for holidays/
   * non-working days, not a naive endDate+1. */
  returnDate: string
  /** Calendar days from today to returnDate — see calendarDaysUntil. */
  daysUntilReturn: number
}

interface CurrentlyOnLeaveTableProps {
  rows: CurrentlyOnLeaveRow[]
}

/**
 * The Leave Dashboard's "who's out right now, and when are they back" view
 * — replaces the old Məzuniyyət Tələbləri (Leave Requests) approval queue
 * table in the same spot. Read-only by design: this is a status view, not
 * an action queue, so unlike the old table there's no per-row
 * approve/reject/cancel here. `rows` is already filtered to active
 * (APPROVED, currently in-progress) leave and sorted soonest-return-first
 * by the caller (leave/page.tsx) — this component only renders.
 */
export function CurrentlyOnLeaveTable({ rows }: CurrentlyOnLeaveTableProps) {
  const t = useTranslations("Leave.dashboard.currentlyOnLeaveTable")
  const tLeave = useTranslations("Employees.profile.leave")
  const tCommon = useTranslations("Common")
  const monthsShort = tCommon.raw("monthsShort") as string[]

  const columns: ColumnDef<CurrentlyOnLeaveRow>[] = useMemo(
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
        id: "positionDepartment",
        header: t("positionDepartment"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.position}
            {row.original.position && row.original.department ? " / " : ""}
            {row.original.department}
          </span>
        ),
      },
      {
        id: "leaveType",
        header: t("leaveType"),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.leaveTypeName}</span>,
      },
      {
        id: "startDate",
        header: t("startDate"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatLeaveDate(row.original.startDate, monthsShort)}
          </span>
        ),
      },
      {
        id: "endDate",
        header: t("endDate"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatLeaveDate(row.original.endDate, monthsShort)}
          </span>
        ),
      },
      {
        id: "returnDate",
        header: t("returnDate"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatLeaveDate(row.original.returnDate, monthsShort)}
          </span>
        ),
      },
      {
        id: "daysUntilReturn",
        header: t("daysUntilReturn"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums text-foreground">
            {tLeave("days", { count: row.original.daysUntilReturn })}
          </span>
        ),
      },
    ],
    [t, tLeave, monthsShort]
  )

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyIcon={Users}
      emptyTitle={t("emptyTitle")}
      emptyDescription={t("emptyDescription")}
    />
  )
}
