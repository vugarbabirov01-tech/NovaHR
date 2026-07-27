"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Plus,
  Upload,
  Users,
} from "lucide-react"

import { useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SearchInput } from "@/components/common/search-input"
import { EmptyState } from "@/components/common/empty-state"
import { EmployeeCard } from "@/components/employees/employee-card"
import { EmployeeFiltersPanel } from "@/components/employees/employee-filters-panel"
import { EmployeeListTable } from "@/components/employees/employee-list-table"
import { ViewToggle } from "@/components/employees/view-toggle"
import { EmployeeWizardModal } from "@/components/employees/wizard/employee-wizard-modal"
import { getEmployeeProfileAction } from "@/app/[locale]/(app)/employees/actions"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { exportEmployeesToCsv, getFullName } from "@/lib/employees"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"
import {
  ALL_VALUE,
  defaultEmployeeFilters,
  type EmployeeFilters,
  type EmployeeView,
} from "@/types/employee-filters"
import type { EmployeeListItem, EmployeeProfile } from "@/types/employee-profile"

interface EmployeeListClientProps {
  employees: EmployeeListItem[]
  masterData: WizardMasterData
}

type WizardState = { mode: "create" } | { mode: "edit"; employeeId: string } | null

export function EmployeeListClient({ employees, masterData }: EmployeeListClientProps) {
  const t = useTranslations("Employees.list")
  const router = useRouter()
  const [view, setView] = usePersistedState<EmployeeView>("employees-view", "list")
  const [filters, setFilters] = useState<EmployeeFilters>(defaultEmployeeFilters)
  const importInputRef = useRef<HTMLInputElement>(null)

  // Add/Edit Employee is one wizard opened as a drawer, reused from both the
  // card view's quick actions and the table view's row actions — not two
  // separate flows and not a dedicated /employees/new or /employees/[id]/edit
  // route. Editing needs the employee's full EmployeeProfile (personal,
  // labourLaw, payroll, documents...), which this page only ever fetches as
  // the slim EmployeeListItem summary, so it's loaded on demand the moment
  // Edit is chosen.
  const [wizardState, setWizardState] = useState<WizardState>(null)
  const [editingProfile, setEditingProfile] = useState<EmployeeProfile | null>(null)
  const [, startProfileFetch] = useTransition()

  function handleAddEmployee() {
    setEditingProfile(null)
    setWizardState({ mode: "create" })
  }

  function handleEditEmployee(employee: { id: string; fullName: string }) {
    setEditingProfile(null)
    setWizardState({ mode: "edit", employeeId: employee.id })
    startProfileFetch(async () => {
      const profile = await getEmployeeProfileAction(employee.id)
      setEditingProfile(profile)
    })
  }

  function handleWizardOpenChange(open: boolean) {
    if (!open) {
      setWizardState(null)
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

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase()

    return employees.filter((employee) => {
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
      if (
        filters.employmentStatus !== ALL_VALUE &&
        employee.employmentStatus !== filters.employmentStatus
      )
        return false
      return true
    })
  }, [employees, filters])

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
          <ViewToggle value={view} onChange={setView} />
          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => {
              event.target.value = ""
            }}
          />
          <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()}>
            <Upload className="size-3.5" strokeWidth={1.75} />
            {t("importEmployees")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Download className="size-3.5" strokeWidth={1.75} />
              {t("export")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => exportEmployeesToCsv(filtered, "employees.csv")}
              >
                <FileSpreadsheet className="size-4" strokeWidth={1.75} />
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
          <Button size="sm" onClick={handleAddEmployee}>
            <Plus className="size-3.5" strokeWidth={1.75} />
            {t("addEmployee")}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : view === "card" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((employee) => (
            <EmployeeCard key={employee.id} employee={employee} onEditEmployee={handleEditEmployee} />
          ))}
        </div>
      ) : (
        <EmployeeListTable data={filtered} onEditEmployee={handleEditEmployee} />
      )}

      {wizardState ? (
        <EmployeeWizardModal
          open={wizardState !== null}
          onOpenChange={handleWizardOpenChange}
          mode={wizardState.mode}
          employeeId={wizardState.mode === "edit" ? wizardState.employeeId : undefined}
          editingProfile={editingProfile}
          masterData={masterData}
          onSuccess={handleWizardSuccess}
        />
      ) : null}
    </div>
  )
}
