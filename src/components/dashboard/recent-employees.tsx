"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { useTranslations } from "next-intl"
import { Inbox } from "lucide-react"

import { Link } from "@/i18n/navigation"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { DataTable } from "@/components/common/data-table"
import { EmploymentStatusBadge } from "@/components/employees/employment-status-badge"
import { WorkStatusBadge } from "@/components/employees/work-status-badge"
import { getFullName, getInitials } from "@/lib/employees"
import type { WorkStatus } from "@/lib/employee-work-status"
import type { EmployeeListItem } from "@/types/employee-profile"

interface RecentEmployeesProps {
  /** The 5 most recently hired employees — resolved server-side from the
   * real employeeDirectory (dashboard/page.tsx), not the disconnected mock
   * array this widget used to read from. */
  employees: EmployeeListItem[]
  /** Resolved once, server-side, by resolveWorkStatus — this component
   * never computes it itself. */
  workStatusByEmployeeId: Record<string, WorkStatus>
}

export function RecentEmployees({ employees, workStatusByEmployeeId }: RecentEmployeesProps) {
  const t = useTranslations("RecentEmployees")

  const columns: ColumnDef<EmployeeListItem>[] = [
    {
      id: "name",
      header: t("columnEmployee"),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback className="bg-accent text-accent-foreground text-[11px]">
              {getInitials(row.original.firstName, row.original.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-foreground">
              {getFullName(row.original)}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.original.position}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "department",
      header: t("columnDepartment"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.department}</span>
      ),
    },
    {
      id: "employmentStatus",
      header: t("columnStatus"),
      cell: ({ row }) => <EmploymentStatusBadge status={row.original.employmentStatus} />,
    },
    {
      id: "workStatus",
      header: t("columnWorkStatus"),
      cell: ({ row }) => (
        <WorkStatusBadge status={workStatusByEmployeeId[row.original.id] ?? "AT_WORK"} />
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
        <CardAction>
          <Link
            href="/employees"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            {t("viewAll")}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={employees}
          emptyIcon={Inbox}
          emptyTitle={t("emptyTitle")}
          emptyDescription={t("emptyDescription")}
        />
      </CardContent>
    </Card>
  )
}
