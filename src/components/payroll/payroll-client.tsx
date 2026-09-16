"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SearchInput } from "@/components/common/search-input"
import { DataTable } from "@/components/common/data-table"
import { PayrollStatusBadge } from "@/components/payroll/payroll-status-badge"
import { getInitials } from "@/lib/employees"
import { formatAzn } from "@/lib/salary-import/apply-salary-update"
import { ALL_VALUE } from "@/types/employee-filters"
import type { PayrollEmployeeRow, PayrollPeriodStatus } from "@/types/payroll"

const PAGE_SIZE = 50

const STATUS_OPTIONS: PayrollPeriodStatus[] = ["DRAFT", "CALCULATED", "APPROVED", "PAID", "CLOSED"]

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

interface PayrollClientProps {
  rows: PayrollEmployeeRow[]
}

export function PayrollClient({ rows }: PayrollClientProps) {
  const t = useTranslations("Payroll")
  const tStatus = useTranslations("Payroll.status")

  const [search, setSearch] = useState("")
  const [company, setCompany] = useState(ALL_VALUE)
  const [workLocation, setWorkLocation] = useState(ALL_VALUE)
  const [position, setPosition] = useState(ALL_VALUE)
  const [status, setStatus] = useState(ALL_VALUE)
  const [pageIndex, setPageIndex] = useState(0)

  const companyOptions = useMemo(() => uniqueSorted(rows.map((r) => r.company)), [rows])
  const workLocationOptions = useMemo(() => uniqueSorted(rows.map((r) => r.workLocation)), [rows])
  const positionOptions = useMemo(() => uniqueSorted(rows.map((r) => r.position)), [rows])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (query && !`${row.fullName} ${row.finCode}`.toLowerCase().includes(query)) return false
      if (company !== ALL_VALUE && row.company !== company) return false
      if (workLocation !== ALL_VALUE && row.workLocation !== workLocation) return false
      if (position !== ALL_VALUE && row.position !== position) return false
      if (status !== ALL_VALUE && row.status !== status) return false
      return true
    })
  }, [rows, search, company, workLocation, position, status])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(pageIndex, pageCount - 1)
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPageIndex(0)
    }
  }

  /** Select's onValueChange passes null when nothing is selected — never
   * actually reachable here since every SelectContent below always has an
   * option selected, but the type must still be satisfied. */
  function resetPageFilter(setter: (value: string) => void) {
    return (value: string | null) => {
      setter(value ?? ALL_VALUE)
      setPageIndex(0)
    }
  }

  const columns: ColumnDef<PayrollEmployeeRow>[] = [
    {
      id: "employee",
      header: t("columnEmployee"),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarImage src={row.original.photoUrl} alt={row.original.fullName} />
            <AvatarFallback className="bg-accent text-accent-foreground text-[11px]">
              {getInitials(row.original.firstName, row.original.lastName)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">{row.original.fullName}</span>
        </div>
      ),
    },
    { accessorKey: "finCode", header: t("columnFin") },
    { accessorKey: "company", header: t("columnCompany") },
    { accessorKey: "workLocation", header: t("columnWorkLocation") },
    { accessorKey: "position", header: t("columnPosition") },
    {
      id: "baseSalary",
      header: t("columnBaseSalary"),
      cell: ({ row }) => formatAzn(row.original.baseSalary),
    },
    {
      id: "additions",
      header: t("columnAdditions"),
      cell: ({ row }) => formatAzn(row.original.additions),
    },
    {
      id: "deductions",
      header: t("columnDeductions"),
      cell: ({ row }) => formatAzn(row.original.deductions),
    },
    {
      id: "netAmount",
      header: t("columnCalculated"),
      cell: ({ row }) => <span className="font-medium text-foreground">{formatAzn(row.original.netAmount)}</span>,
    },
    {
      id: "status",
      header: t("columnStatus"),
      cell: ({ row }) => <PayrollStatusBadge status={row.original.status} label={tStatus(row.original.status)} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder={t("searchPlaceholder")}
          containerClassName="w-full sm:max-w-xs"
          value={search}
          onChange={(event) => resetPage(setSearch)(event.target.value)}
        />
        <Select value={company} onValueChange={resetPageFilter(setCompany)}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue>{(value: string) => (value === ALL_VALUE ? t("allCompanies") : value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t("allCompanies")}</SelectItem>
            {companyOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={workLocation} onValueChange={resetPageFilter(setWorkLocation)}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue>{(value: string) => (value === ALL_VALUE ? t("allWorkLocations") : value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t("allWorkLocations")}</SelectItem>
            {workLocationOptions.map((w) => (
              <SelectItem key={w} value={w}>
                {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={position} onValueChange={resetPageFilter(setPosition)}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue>{(value: string) => (value === ALL_VALUE ? t("allPositions") : value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t("allPositions")}</SelectItem>
            {positionOptions.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={resetPageFilter(setStatus)}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue>
              {(value: string) => (value === ALL_VALUE ? t("allStatuses") : tStatus(value))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t("allStatuses")}</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {tStatus(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{t("resultsCount", { count: filtered.length })}</span>
      </div>

      <DataTable
        columns={columns}
        data={pageRows}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />

      {filtered.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("pageIndicator", { current: currentPage + 1, total: pageCount })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPage === 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
            >
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
