"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Banknote,
  Download,
  FileText,
  Loader2,
  Printer,
  Plus,
  Upload,
  Users,
  X,
} from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchInput } from "@/components/common/search-input"
import { EmptyState } from "@/components/common/empty-state"
import { EmployeeCard } from "@/components/employees/employee-card"
import { EmployeeFiltersPanel } from "@/components/employees/employee-filters-panel"
import { EmployeeListTable } from "@/components/employees/employee-list-table"
import { ViewToggle } from "@/components/employees/view-toggle"
import { ConfirmDeleteDialog } from "@/components/master-data/confirm-delete-dialog"
import { toast } from "@/components/ui/toast"
import { deleteEmployeesAction } from "@/app/[locale]/(app)/employees/actions"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { getFullName, statusMessageKeys } from "@/lib/employees"
import { computeSmartFilterMatches, getEmployeeSmartFilters } from "@/lib/employee-smart-filters"
import {
  buildEmployeesReturnUrl,
  filtersToSearchParams,
  searchParamsToFilters,
} from "@/lib/employee-filters-url"
import { HR_SETTINGS } from "@/lib/hr-settings"
import { cn } from "@/lib/utils"
import type { WorkStatus } from "@/lib/employee-work-status"
import {
  ALL_VALUE,
  DEFAULT_STATUS_FILTER,
  DEFAULT_VISIBLE_STATUSES,
  type EmployeeFilters,
  type EmployeeView,
} from "@/types/employee-filters"
import type { EmployeeListItem, EmploymentStatus } from "@/types/employee-profile"

const statusFilterOptions: EmploymentStatus[] = [
  "active",
  "probation",
  "suspended",
  "inactive",
  "terminated",
]

// Edit Employee is now its own full page (/employees/[id]/edit) — the exact
// same EmployeeWizard component Create already runs full-page, reached via
// EmployeeQuickActions' ordinary href, not a Sheet this component has to
// own the open/loading/error state for.

// Export is one menu item away from never being clicked in a given visit,
// so its dialog (and the xlsx/export plumbing it pulls in) is code-split
// out of the list's own bundle too.
const ExportEmployeesDialog = dynamic(
  () =>
    import("@/components/employees/export/export-employees-dialog").then(
      (mod) => mod.ExportEmployeesDialog
    ),
  {
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
      </div>
    ),
  }
)

interface EmployeeListClientProps {
  employees: EmployeeListItem[]
  /** Resolved once, server-side, by resolveWorkStatus (see
   * employees/page.tsx) — plain Record rather than a Map so it serializes
   * cleanly across the Server->Client boundary. Neither this component nor
   * EmployeeCard/EmployeeListTable ever compute a work status themselves. */
  workStatusByEmployeeId: Record<string, WorkStatus>
}

export function EmployeeListClient({ employees, workStatusByEmployeeId }: EmployeeListClientProps) {
  const t = useTranslations("Employees.list")
  const tCommon = useTranslations("Common")
  const tStatus = useTranslations("Status")
  const tSmartFilters = useTranslations("Employees.smartFilters")
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = usePersistedState<EmployeeView>("employees-view", "list")
  // The URL is the source of truth for every filter (search, status,
  // Advanced Filters, Smart Filter) — hydrated once here from whatever
  // query string the page loaded with, then kept in sync below so
  // navigating to an Employee Profile and back (or the browser's own Back
  // button) restores exactly what was active, instead of resetting to
  // defaults the way a plain useState would on remount.
  const [filters, setFilters] = useState<EmployeeFilters>(() => {
    const hydrated = searchParamsToFilters(searchParams)
    const isValidSmartFilter = Boolean(
      hydrated.smartFilter && getEmployeeSmartFilters().some((filter) => filter.id === hydrated.smartFilter)
    )
    return isValidSmartFilter ? hydrated : { ...hydrated, smartFilter: "" }
  })

  useEffect(() => {
    const query = filtersToSearchParams(filters).toString()
    router.replace(query ? `/employees?${query}` : "/employees", { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  // Threaded onto every profile link the list renders (Employee Card,
  // table rows, "View Profile" in the quick-actions menu) — the one thing
  // that makes "Back to Employees" reliable regardless of browser history
  // (a fresh tab, a bookmarked profile link, middle-click-opened tab, ...),
  // per the same reasoning smartFilter's deep link already relies on.
  const returnTo = useMemo(() => buildEmployeesReturnUrl("/employees", filters), [filters])


  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([])
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)

  function handleViewChange(nextView: EmployeeView) {
    // Selection only exists in the table view's checkboxes — switching away
    // from it unmounts that state, so keeping stale ids around here would
    // make "Export Selected" lie about what's actually selected.
    if (nextView !== "list") setSelectedIds([])
    setView(nextView)
  }

  function handleSmartFilterSelect(id: string) {
    // The URL-sync effect above picks up this state change and updates
    // ?smartFilter= on its own — no manual router call needed here anymore.
    setFilters((prev) => ({ ...prev, smartFilter: id }))

    // Applying a card is meant to feel like jumping straight to the answer —
    // scroll the (already-filtered) results into view instead of leaving HR
    // to scroll past the Action Center themselves. Clearing stays put.
    if (id) {
      requestAnimationFrame(() => {
        document.getElementById("employee-results")?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }
  }

  function handleBulkDeleteRequest(ids: string[]) {
    if (ids.length === 0) return
    setBulkDeleteError(null)
    setBulkDeleteIds(ids)
    setBulkDeleteDialogOpen(true)
  }

  async function handleBulkDeleteConfirm() {
    setIsBulkDeleting(true)
    setBulkDeleteError(null)
    const result = await deleteEmployeesAction(bulkDeleteIds)
    setIsBulkDeleting(false)

    if (result.success) {
      setBulkDeleteDialogOpen(false)
      setSelectedIds([])
      toast.success(t("bulkDeleteSuccess", { count: result.deletedCount ?? bulkDeleteIds.length }))
      router.refresh()
    } else {
      setBulkDeleteError(tCommon("genericError"))
    }
  }

  // One pass over `employees` computes every Smart Filter's matches — only
  // recomputed when the employee list itself changes, never on Search/
  // Status/Advanced Filters keystrokes or Smart Filter selection.
  const smartFilterMatches = useMemo(() => computeSmartFilterMatches(employees), [employees])
  const selectedSmartFilterIds = useMemo(() => {
    if (!filters.smartFilter) return null
    return new Set(smartFilterMatches[filters.smartFilter]?.map((employee) => employee.id) ?? [])
  }, [filters.smartFilter, smartFilterMatches])
  // The active filter's own definition (icon, emoji, severity, title/badge
  // keys) — threaded down to the results summary bar and to each employee
  // card/row's temporary badge. Both reuse this single lookup, no separate
  // registry scan anywhere else.
  const activeSmartFilter = useMemo(
    () => (filters.smartFilter ? getEmployeeSmartFilters().find((f) => f.id === filters.smartFilter) ?? null : null),
    [filters.smartFilter]
  )
  const activeSmartFilterCount = activeSmartFilter ? smartFilterMatches[activeSmartFilter.id]?.length ?? 0 : 0

  // Same Smart Filter + Status narrowing `filtered` applies below, minus the
  // Advanced Filters themselves — this is the base set EmployeeFiltersPanel
  // builds its options and counts from, so switching "Aktiv Əməkdaşlar" ↔
  // "Hamısı" updates every option's count accordingly, without each Advanced
  // Filter field collapsing every other field's options as it's chosen.
  const statusFilteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      if (selectedSmartFilterIds && !selectedSmartFilterIds.has(employee.id)) return false
      if (filters.employmentStatus === DEFAULT_STATUS_FILTER) {
        if (!DEFAULT_VISIBLE_STATUSES.includes(employee.employmentStatus)) return false
      } else if (
        filters.employmentStatus !== ALL_VALUE &&
        employee.employmentStatus !== filters.employmentStatus
      ) {
        return false
      }
      return true
    })
  }, [employees, filters.employmentStatus, selectedSmartFilterIds])

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase()

    return employees.filter((employee) => {
      if (selectedSmartFilterIds && !selectedSmartFilterIds.has(employee.id)) return false
      if (query) {
        const haystack = [
          getFullName(employee),
          employee.finCode,
          employee.employeeNumber,
          employee.email,
          employee.phone,
          employee.position,
          employee.department,
          employee.workLocation,
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      if (filters.company !== ALL_VALUE && employee.company !== filters.company) return false
      if (filters.workLocation !== ALL_VALUE && employee.workLocation !== filters.workLocation) return false
      if (filters.department !== ALL_VALUE && employee.department !== filters.department) return false
      if (filters.position !== ALL_VALUE && employee.position !== filters.position) return false
      if (filters.manager !== ALL_VALUE && employee.managerId !== filters.manager) return false
      if (filters.employmentType !== ALL_VALUE && employee.employmentType !== filters.employmentType)
        return false
      // Terminated (and Suspended/Inactive) employees stay out of the
      // default view — they only ever show up once a specific status or
      // "All Employees" is explicitly chosen.
      if (filters.employmentStatus === DEFAULT_STATUS_FILTER) {
        if (!DEFAULT_VISIBLE_STATUSES.includes(employee.employmentStatus)) return false
      } else if (
        filters.employmentStatus !== ALL_VALUE &&
        employee.employmentStatus !== filters.employmentStatus
      ) {
        return false
      }
      return true
    })
  }, [employees, filters, selectedSmartFilterIds])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <SearchInput
            placeholder={t("searchPlaceholder")}
            containerClassName="w-full sm:max-w-xs"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />
          <Select
            value={filters.employmentStatus}
            onValueChange={(v) => setFilters({ ...filters, employmentStatus: v ?? DEFAULT_STATUS_FILTER })}
          >
            <SelectTrigger size="sm" className="w-44">
              <SelectValue>
                {(value: string) => {
                  if (value === DEFAULT_STATUS_FILTER) return t("statusFilterDefault")
                  if (value === ALL_VALUE) return t("statusFilterAll")
                  return tStatus(statusMessageKeys[value as EmploymentStatus])
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_STATUS_FILTER}>{t("statusFilterDefault")}</SelectItem>
              {statusFilterOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {tStatus(statusMessageKeys[status])}
                </SelectItem>
              ))}
              <SelectItem value={ALL_VALUE}>{t("statusFilterAll")}</SelectItem>
            </SelectContent>
          </Select>
          <EmployeeFiltersPanel
            employees={statusFilteredEmployees}
            filters={filters}
            onChange={setFilters}
          />
          <span className="text-sm text-muted-foreground">
            {t("resultsCount", { count: filtered.length })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle value={view} onChange={handleViewChange} />
          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <Link href="/employees/import" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <Upload className="size-3.5" strokeWidth={1.75} />
            {t("importEmployees")}
          </Link>
          <Link href="/employees/salary-import" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <Banknote className="size-3.5" strokeWidth={1.75} />
            {t("importSalaries")}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Download className="size-3.5" strokeWidth={1.75} />
              {t("export")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsExportDialogOpen(true)}>
                <Download className="size-4" strokeWidth={1.75} />
                {t("exportExcel")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}>
                <FileText className="size-4" strokeWidth={1.75} />
                {t("exportPdf")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}>
                <Printer className="size-4" strokeWidth={1.75} />
                {t("print")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/employees/new" className={cn(buttonVariants({ size: "sm" }))}>
            <Plus className="size-3.5" strokeWidth={1.75} />
            {t("addEmployee")}
          </Link>
        </div>
      </div>

      <div id="employee-results" className="flex flex-col gap-3 scroll-mt-4">
        {activeSmartFilter ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-sm text-foreground">
              <span className="text-muted-foreground">{tSmartFilters("summaryLabel")} </span>
              <span className="font-medium">
                {tSmartFilters(activeSmartFilter.titleKey, activeSmartFilter.messageParams?.(HR_SETTINGS))}
              </span>
              <span className="text-muted-foreground"> — {tSmartFilters("employeeCount", { count: activeSmartFilterCount })}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={() => handleSmartFilterSelect("")}>
              <X className="size-3.5" strokeWidth={1.75} />
              {tSmartFilters("summaryClear")}
            </Button>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : view === "card" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                workStatus={workStatusByEmployeeId[employee.id] ?? "AT_WORK"}
                activeSmartFilter={activeSmartFilter}
                returnTo={returnTo}
              />
            ))}
          </div>
        ) : (
          <EmployeeListTable
            data={filtered}
            workStatusByEmployeeId={workStatusByEmployeeId}
            onSelectionChange={setSelectedIds}
            onBulkDelete={handleBulkDeleteRequest}
            activeSmartFilter={activeSmartFilter}
            returnTo={returnTo}
          />
        )}
      </div>

      {isExportDialogOpen ? (
        <ExportEmployeesDialog
          open={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
          allIds={employees.map((employee) => employee.id)}
          filteredIds={filtered.map((employee) => employee.id)}
          selectedIds={selectedIds}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={(open) => {
          setBulkDeleteDialogOpen(open)
          if (!open) {
            setBulkDeleteIds([])
            setBulkDeleteError(null)
          }
        }}
        title={t("bulkDeleteConfirmTitle")}
        description={t("bulkDeleteConfirmDescription", { count: bulkDeleteIds.length })}
        onConfirm={handleBulkDeleteConfirm}
        isDeleting={isBulkDeleting}
        blockedReason={bulkDeleteError}
      />
    </div>
  )
}
