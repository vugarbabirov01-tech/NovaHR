"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/common/data-table"
import { SearchInput } from "@/components/common/search-input"
import { Link } from "@/i18n/navigation"

export interface CandidateRow {
  id: string
  fullName: string
  phone: string
  email: string
  finCode: string
  source: string
  /** ISO timestamp */
  createdAt: string
  applications: Array<{ requisitionId: string; code: string; title: string; stage: string }>
}

export function CandidatesClient({ rows }: { rows: CandidateRow[] }) {
  const t = useTranslations("Recruitment")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) => `${row.fullName} ${row.phone} ${row.email} ${row.finCode}`.toLowerCase().includes(query))
  }, [rows, search])

  const columns: ColumnDef<CandidateRow>[] = [
    {
      id: "name",
      header: t("candidates.columns.name"),
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.fullName}</span>,
    },
    {
      id: "contact",
      header: t("candidates.columns.contact"),
      cell: ({ row }) => (
        <div className="flex flex-col text-sm">
          <span className="tabular-nums">{row.original.phone || "—"}</span>
          <span className="text-xs text-muted-foreground">{row.original.email}</span>
        </div>
      ),
    },
    {
      id: "source",
      header: t("candidates.columns.source"),
      cell: ({ row }) => <span className="text-muted-foreground">{t(`source.${row.original.source}` as never)}</span>,
    },
    {
      id: "applications",
      header: t("candidates.columns.applications"),
      cell: ({ row }) =>
        row.original.applications.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-col gap-0.5 text-sm">
            {row.original.applications.map((application) => (
              <Link key={application.requisitionId} href={`/recruitment/${application.requisitionId}`} className="hover:underline">
                {application.title}
                <span className="text-muted-foreground"> · {t(`stage.${application.stage}` as never)}</span>
              </Link>
            ))}
          </div>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder={t("candidates.searchPlaceholder")}
          containerClassName="w-full sm:max-w-xs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <span className="text-sm text-muted-foreground">{t("candidates.resultsCount", { count: filtered.length })}</span>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        emptyTitle={t("candidates.emptyTitle")}
        emptyDescription={t("candidates.emptyDescription")}
      />
    </div>
  )
}
