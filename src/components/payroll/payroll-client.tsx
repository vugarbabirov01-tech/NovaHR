"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
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
import { PayrollEmployeeSheet } from "@/components/payroll/payroll-employee-sheet"
import { exportPayrollAction } from "@/app/[locale]/(app)/payroll/actions"
import { toast } from "@/components/ui/toast"
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
  year: number
  month: number
  locale: string
  /** False once the period is approved: adjustments are read-only. */
  editable: boolean
}

function downloadBase64Xlsx(base64: string, fileName: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function PayrollClient({ rows, year, month, locale, editable }: PayrollClientProps) {
  const t = useTranslations("Payroll")
  const tStatus = useTranslations("Payroll.status")

  const [search, setSearch] = useState("")
  const [company, setCompany] = useState(ALL_VALUE)
  const [workLocation, setWorkLocation] = useState(ALL_VALUE)
  const [position, setPosition] = useState(ALL_VALUE)
  const [status, setStatus] = useState(ALL_VALUE)
  const [pageIndex, setPageIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Looked up by id so the open panel follows fresh data after a refresh.
  const selected = rows.find((row) => row.id === selectedId) ?? null

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

  const money = (value: number | undefined) =>
    value === undefined ? <span className="text-muted-foreground">—</span> : formatAzn(value)

  const numberColumn = "text-right tabular-nums whitespace-nowrap"

  async function handleExport() {
    setIsExporting(true)
    try {
      const result = await exportPayrollAction(
        year,
        month,
        locale,
        filtered.map((row) => row.employeeId)
      )
      if (result.success) downloadBase64Xlsx(result.data.base64, result.data.fileName)
      else toast.error(t("exportError"))
    } finally {
      setIsExporting(false)
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
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-foreground">{row.original.fullName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {[row.original.position, row.original.workLocation].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "grossSalary",
      header: t("columnGross"),
      meta: { className: numberColumn },
      cell: ({ row }) => money(row.original.grossSalary),
    },
    {
      id: "baseSalary",
      header: t("columnNet"),
      meta: { className: numberColumn },
      cell: ({ row }) => money(row.original.baseSalary),
    },
    {
      id: "additions",
      header: t("columnAdditions"),
      meta: { className: numberColumn },
      cell: ({ row }) => money(row.original.additions),
    },
    {
      id: "deductions",
      header: t("columnDeductions"),
      meta: { className: numberColumn },
      cell: ({ row }) => money(row.original.deductions),
    },
    {
      id: "netAmount",
      header: t("columnPayable"),
      meta: { className: numberColumn },
      cell: ({ row }) => <span className="font-semibold text-foreground">{formatAzn(row.original.netAmount)}</span>,
    },
    {
      id: "status",
      header: t("columnStatus"),
      cell: ({ row }) => <PayrollStatusBadge status={row.original.status} label={tStatus(row.original.status)} />,
    },
  ]

  // Totals cover every row matching the current filters, not just the visible page.
  const totals = useMemo(
    () => ({
      gross: filtered.reduce((sum, row) => sum + (row.grossSalary ?? 0), 0),
      net: filtered.reduce((sum, row) => sum + row.baseSalary, 0),
      additions: filtered.reduce((sum, row) => sum + row.additions, 0),
      deductions: filtered.reduce((sum, row) => sum + row.deductions, 0),
      payable: filtered.reduce((sum, row) => sum + row.netAmount, 0),
    }),
    [filtered]
  )

  const footer =
    filtered.length > 0 ? (
      <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
        <TableCell className="px-4 py-3">{t("footerTotal", { count: filtered.length })}</TableCell>
        <TableCell className={"px-4 py-3 " + numberColumn}>{formatAzn(totals.gross)}</TableCell>
        <TableCell className={"px-4 py-3 " + numberColumn}>{formatAzn(totals.net)}</TableCell>
        <TableCell className={"px-4 py-3 " + numberColumn}>{formatAzn(totals.additions)}</TableCell>
        <TableCell className={"px-4 py-3 " + numberColumn}>{formatAzn(totals.deductions)}</TableCell>
        <TableCell className={"px-4 py-3 " + numberColumn}>{formatAzn(totals.payable)}</TableCell>
        <TableCell className="px-4 py-3" />
      </TableRow>
    ) : undefined

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
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={isExporting || filtered.length === 0}
          onClick={handleExport}
        >
          <Download className="size-3.5" strokeWidth={1.75} />
          {isExporting ? t("exporting") : t("exportButton")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={pageRows}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        footer={footer}
        onRowClick={(row) => setSelectedId(row.id)}
      />

      <PayrollEmployeeSheet
        row={selected}
        editable={editable}
        onOpenChange={(open) => !open && setSelectedId(null)}
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
