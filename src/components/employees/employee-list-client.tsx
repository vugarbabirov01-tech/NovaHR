"use client"

import { useMemo, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
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
import { getEmployeeProfileAction, getWizardMasterDataAction } from "@/app/[locale]/(app)/employees/actions"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { getFullName, statusMessageKeys } from "@/lib/employees"
import { computeSmartFilterMatches, getEmployeeSmartFilters } from "@/lib/employee-smart-filters"
import { HR_SETTINGS } from "@/lib/hr-settings"
import { cn } from "@/lib/utils"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"
import type { WorkStatus } from "@/lib/employee-work-status"
import {
  ALL_VALUE,
  DEFAULT_STATUS_FILTER,
  DEFAULT_VISIBLE_STATUSES,
  defaultEmployeeFilters,
  type EmployeeFilters,
  type EmployeeView,
} from "@/types/employee-filters"
import type { EmployeeListItem, EmployeeProfile, EmploymentStatus } from "@/types/employee-profile"

const statusFilterOptions: EmploymentStatus[] = [
  "active",
  "probation",
  "suspended",
  "inactive",
  "terminated",
]

// The Edit wizard (its Sheet chrome, all six steps, validation) is only ever
// needed once HR actually clicks Edit — code-split it out of the Employees
// list's own bundle so visiting the list never ships that JS up front. No
// ssr:false: editingEmployeeId starts at null, so this never renders during
// the server pass anyway — nothing to opt out of, and keeping SSR on means
// no extra client/server behavior split to reason about. The fallback below
// reuses Sheet's own overlay tone (bg-black/10) so the moment between "Edit
// clicked" and "chunk downloaded" reads as the same drawer opening, not a
// different, unrelated loading state.
const EmployeeWizardModal = dynamic(
  () =>
    import("@/components/employees/wizard/employee-wizard-modal").then(
      (mod) => mod.EmployeeWizardModal
    ),
  {
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
      </div>
    ),
  }
)

// Same reasoning as the wizard above — Export is one menu item away from
// never being clicked in a given visit, so its dialog (and the xlsx/export
// plumbing it pulls in) is code-split out of the list's own bundle too.
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
  const tStatus = useTranslations("Status")
  const tSmartFilters = useTranslations("Employees.smartFilters")
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = usePersistedState<EmployeeView>("employees-view", "list")
  // Smart Filter selection is the one filter dimension that deep-links —
  // read once from ?smartFilter= on load, same idea as the Employee
  // Profile's ?tab= deep link.
  const [filters, setFilters] = useState<EmployeeFilters>(() => {
    const smartFilterParam = searchParams.get("smartFilter")
    const isValidSmartFilter = Boolean(
      smartFilterParam && getEmployeeSmartFilters().some((filter) => filter.id === smartFilterParam)
    )
    return { ...defaultEmployeeFilters, smartFilter: isValidSmartFilter ? smartFilterParam! : "" }
  })

  // Edit Employee reuses the exact same EmployeeWizard component as Create
  // (/employees/new, a full page — long-form data entry earns the full
  // content area), just hosted in a Sheet instead, since edits are shorter
  // interruptions that benefit from staying in list context. Editing needs
  // the employee's full EmployeeProfile (personal, labourLaw, payroll,
  // documents...), which this page only ever fetches as the slim
  // EmployeeListItem summary, so it's loaded on demand the moment Edit is
  // chosen.
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<EmployeeProfile | null>(null)
  // The wizard's master data (departments/positions/companies/branches/
  // schedules/managers) isn't needed to show the list, only to edit or
  // create — so it's fetched here on demand, the first time Edit is
  // clicked, and kept around afterward as a simple in-memory cache: every
  // later edit in this session reuses it instead of re-fetching.
  const [masterData, setMasterData] = useState<WizardMasterData | null>(null)
  const [editLoadError, setEditLoadError] = useState(false)
  const [, startProfileFetch] = useTransition()

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)

  function handleViewChange(nextView: EmployeeView) {
    // Selection only exists in the table view's checkboxes — switching away
    // from it unmounts that state, so keeping stale ids around here would
    // make "Export Selected" lie about what's actually selected.
    if (nextView !== "list") setSelectedIds([])
    setView(nextView)
  }

  function handleSmartFilterSelect(id: string) {
    setFilters((prev) => ({ ...prev, smartFilter: id }))
    const params = new URLSearchParams(searchParams.toString())
    if (id) params.set("smartFilter", id)
    else params.delete("smartFilter")
    const query = params.toString()
    router.replace(query ? `/employees?${query}` : "/employees", { scroll: false })

    // Applying a card is meant to feel like jumping straight to the answer —
    // scroll the (already-filtered) results into view instead of leaving HR
    // to scroll past the Action Center themselves. Clearing stays put.
    if (id) {
      requestAnimationFrame(() => {
        document.getElementById("employee-results")?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }
  }

  function loadEditData(employeeId: string) {
    setEditingProfile(null)
    setEditLoadError(false)
    startProfileFetch(async () => {
      try {
        // masterData rarely changes within a session, so once it's loaded
        // once it's reused for every subsequent edit — only the profile
        // (which differs per employee) is fetched every time.
        const [profile, freshMasterData] = await Promise.all([
          getEmployeeProfileAction(employeeId),
          masterData ?? getWizardMasterDataAction(),
        ])
        setEditingProfile(profile)
        if (!masterData) setMasterData(freshMasterData)
      } catch {
        // Either request failing (network blip, DB hiccup) must not leave
        // the modal spinning forever — surface a retry instead.
        setEditLoadError(true)
      }
    })
  }

  function handleEditEmployee(employee: { id: string; fullName: string }) {
    setEditingEmployeeId(employee.id)
    loadEditData(employee.id)
  }

  function handleRetryEditLoad() {
    if (editingEmployeeId) loadEditData(editingEmployeeId)
  }

  function handleWizardOpenChange(open: boolean) {
    if (!open) {
      setEditingEmployeeId(null)
      setEditingProfile(null)
      setEditLoadError(false)
    }
  }

  function handleWizardSuccess() {
    // The wizard's own success screen stays open (inside the drawer) so HR
    // can still choose "View Profile" — this only makes sure the list
    // behind it is already showing the new/updated record by the time they
    // close it, since Server Actions revalidate the cache but this page
    // itself doesn't re-fetch until told to.
    router.refresh()
  }

  const managerNames = useMemo(
    () =>
      Array.from(
        new Set(employees.map((e) => e.managerName).filter((name): name is string => Boolean(name)))
      ).sort(),
    [employees]
  )

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
      if (filters.branch !== ALL_VALUE && employee.branch !== filters.branch) return false
      if (filters.workLocation !== ALL_VALUE && employee.workLocation !== filters.workLocation) return false
      if (filters.department !== ALL_VALUE && employee.department !== filters.department) return false
      if (filters.position !== ALL_VALUE && employee.position !== filters.position) return false
      if (filters.manager !== ALL_VALUE && employee.managerName !== filters.manager) return false
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
            employees={employees}
            filters={filters}
            onChange={setFilters}
            managerNames={managerNames}
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
                onEditEmployee={handleEditEmployee}
                activeSmartFilter={activeSmartFilter}
              />
            ))}
          </div>
        ) : (
          <EmployeeListTable
            data={filtered}
            workStatusByEmployeeId={workStatusByEmployeeId}
            onEditEmployee={handleEditEmployee}
            onSelectionChange={setSelectedIds}
            activeSmartFilter={activeSmartFilter}
          />
        )}
      </div>

      {editingEmployeeId ? (
        <EmployeeWizardModal
          open={editingEmployeeId !== null}
          onOpenChange={handleWizardOpenChange}
          employeeId={editingEmployeeId}
          editingProfile={editingProfile}
          masterData={masterData}
          loadError={editLoadError}
          onRetry={handleRetryEditLoad}
          onSuccess={handleWizardSuccess}
        />
      ) : null}

      {isExportDialogOpen ? (
        <ExportEmployeesDialog
          open={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
          allIds={employees.map((employee) => employee.id)}
          filteredIds={filtered.map((employee) => employee.id)}
          selectedIds={selectedIds}
        />
      ) : null}
    </div>
  )
}
