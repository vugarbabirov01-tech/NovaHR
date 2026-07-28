"use client"

import { useMemo, useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Download,
  FileText,
  Printer,
  Plus,
  Upload,
  Users,
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
import { EmployeeSmartFiltersPanel } from "@/components/employees/employee-smart-filters-panel"
import { EmployeeListTable } from "@/components/employees/employee-list-table"
import { ViewToggle } from "@/components/employees/view-toggle"
import { EmployeeWizardModal } from "@/components/employees/wizard/employee-wizard-modal"
import { ExportEmployeesDialog } from "@/components/employees/export/export-employees-dialog"
import { getEmployeeProfileAction } from "@/app/[locale]/(app)/employees/actions"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { getFullName, statusMessageKeys } from "@/lib/employees"
import { computeSmartFilterMatches, getEmployeeSmartFilters } from "@/lib/employee-smart-filters"
import { cn } from "@/lib/utils"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"
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
  "on-leave",
  "business-trip",
  "suspended",
  "inactive",
  "terminated",
]

interface EmployeeListClientProps {
  employees: EmployeeListItem[]
  masterData: WizardMasterData
}

export function EmployeeListClient({ employees, masterData }: EmployeeListClientProps) {
  const t = useTranslations("Employees.list")
  const tStatus = useTranslations("Status")
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
  }

  function handleEditEmployee(employee: { id: string; fullName: string }) {
    setEditingProfile(null)
    setEditingEmployeeId(employee.id)
    startProfileFetch(async () => {
      const profile = await getEmployeeProfileAction(employee.id)
      setEditingProfile(profile)
    })
  }

  function handleWizardOpenChange(open: boolean) {
    if (!open) {
      setEditingEmployeeId(null)
      setEditingProfile(null)
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

      <EmployeeSmartFiltersPanel
        employees={employees}
        selectedId={filters.smartFilter}
        onSelect={handleSmartFilterSelect}
      />

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
              onEditEmployee={handleEditEmployee}
            />
          ))}
        </div>
      ) : (
        <EmployeeListTable
          data={filtered}
          onEditEmployee={handleEditEmployee}
          onSelectionChange={setSelectedIds}
        />
      )}

      {editingEmployeeId ? (
        <EmployeeWizardModal
          open={editingEmployeeId !== null}
          onOpenChange={handleWizardOpenChange}
          employeeId={editingEmployeeId}
          editingProfile={editingProfile}
          masterData={masterData}
          onSuccess={handleWizardSuccess}
        />
      ) : null}

      <ExportEmployeesDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        allIds={employees.map((employee) => employee.id)}
        filteredIds={filtered.map((employee) => employee.id)}
        selectedIds={selectedIds}
      />
    </div>
  )
}
