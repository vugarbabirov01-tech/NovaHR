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
import { StatusBadge } from "@/components/common/status-badge"
import { recentEmployees } from "@/data/employees"
import type { Employee } from "@/types/employee"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function RecentEmployees() {
  const t = useTranslations("RecentEmployees")

  const columns: ColumnDef<Employee>[] = [
    {
      accessorKey: "name",
      header: t("columnEmployee"),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback className="bg-accent text-accent-foreground text-[11px]">
              {initials(row.original.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-foreground">
              {row.original.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.original.role}
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
      accessorKey: "status",
      header: t("columnStatus"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
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
          data={recentEmployees.slice(0, 5)}
          emptyIcon={Inbox}
          emptyTitle={t("emptyTitle")}
          emptyDescription={t("emptyDescription")}
        />
      </CardContent>
    </Card>
  )
}
