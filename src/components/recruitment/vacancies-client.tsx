"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/common/data-table"
import { SearchInput } from "@/components/common/search-input"
import { RequisitionStatusBadge } from "@/components/recruitment/requisition-status-badge"
import { useRouter } from "@/i18n/navigation"
import { REQUISITION_STATUSES, type RequisitionStatus } from "@/lib/recruitment/recruitment-rules"

export interface VacancyRow {
  id: string
  code: string
  title: string
  department: string
  branch: string
  openings: number
  hired: number
  activeCandidates: number
  status: RequisitionStatus
}

export function VacanciesClient({ rows }: { rows: VacancyRow[] }) {
  const t = useTranslations("Recruitment")
  const tStatus = useTranslations("Recruitment.status")
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("ALL")

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (status !== "ALL" && row.status !== status) return false
      if (query && !`${row.code} ${row.title} ${row.department} ${row.branch}`.toLowerCase().includes(query)) return false
      return true
    })
  }, [rows, search, status])

  const columns: ColumnDef<VacancyRow>[] = [
    {
      id: "title",
      header: t("list.columns.title"),
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-foreground">{row.original.title}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{row.original.code}</span>
        </div>
      ),
    },
    {
      id: "place",
      header: t("list.columns.place"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {[row.original.department, row.original.branch].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      id: "openings",
      header: t("list.columns.openings"),
      meta: { className: "text-right tabular-nums whitespace-nowrap" },
      cell: ({ row }) => `${row.original.hired} / ${row.original.openings}`,
    },
    {
      id: "candidates",
      header: t("list.columns.candidates"),
      meta: { className: "text-right tabular-nums whitespace-nowrap" },
      cell: ({ row }) => row.original.activeCandidates,
    },
    {
      id: "status",
      header: t("list.columns.status"),
      cell: ({ row }) => <RequisitionStatusBadge status={row.original.status} label={tStatus(row.original.status)} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder={t("list.searchPlaceholder")}
          containerClassName="w-full sm:max-w-xs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label={t("list.columns.status")}
        >
          <option value="ALL">{t("list.allStatuses")}</option>
          {REQUISITION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {tStatus(value)}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">{t("list.resultsCount", { count: filtered.length })}</span>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        emptyTitle={t("list.emptyTitle")}
        emptyDescription={t("list.emptyDescription")}
        onRowClick={(row) => router.push(`/recruitment/${row.id}`)}
      />
    </div>
  )
}
