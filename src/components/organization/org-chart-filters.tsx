"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { ListFilter, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field } from "@/components/common/field"
import { countBy, statusMessageKeys } from "@/lib/employees"
import { ALL_VALUE } from "@/types/employee-filters"
import { defaultOrganizationChartFilters, hasActiveOrganizationChartFilters } from "@/lib/organization/filter-tree"
import type { OrganizationBranchOption, OrganizationChartFilters, OrganizationCompanyOption } from "@/types/organization"
import type { EmployeeListItem, EmploymentStatus } from "@/types/employee-profile"

const employmentStatuses: EmploymentStatus[] = ["active", "probation", "suspended", "terminated", "inactive"]

function uniqueSorted(values: (string | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort((a, b) => a.localeCompare(b))
}

interface OrgChartFiltersProps {
  employees: EmployeeListItem[]
  managerNames: string[]
  /** The real Company/Branch catalog (Administration module) — see
   * types/organization.ts's own doc comment on why Branch's options come
   * from here, not from employees.map(e => e.branch). */
  companies: OrganizationCompanyOption[]
  branches: OrganizationBranchOption[]
  filters: OrganizationChartFilters
  onChange: (filters: OrganizationChartFilters) => void
}

/** Company/Branch/Department/Position/Manager/Employment-status — §9. Same
 * Popover + Select layout as EmployeeFiltersPanel (employee-filters-panel.tsx),
 * a dedicated instance rather than a shared component since each screen owns
 * its own filter shape, matching how this codebase already treats Leave's
 * and Employees' filter panels as independent despite the visual overlap.
 * Department/Position/Manager/Status options are still derived from
 * `employees` itself (uniqueSorted(employees.map(...))) — those fields have
 * real per-employee data. Company/Branch options come from the real
 * Administration catalog instead (see the props' own doc comment): Branch
 * is also scoped to whichever company is currently selected (or every
 * branch across every company, when "All Companies" is selected), and
 * picking a company that no longer matches the current branch selection
 * resets Branch back to "All Branches" rather than silently filtering by a
 * now-impossible combination. */
export function OrgChartFilters({ employees, managerNames, companies, branches, filters, onChange }: OrgChartFiltersProps) {
  const t = useTranslations("OrganizationChart.filters")
  const tStatus = useTranslations("Status")

  const counts = useMemo(
    () => ({
      company: countBy(employees, (e) => e.company),
      branch: countBy(employees, (e) => e.branchId),
      department: countBy(employees, (e) => e.department),
      position: countBy(employees, (e) => e.position),
      manager: countBy(employees, (e) => e.managerName),
      employmentStatus: countBy(employees, (e) => e.employmentStatus),
    }),
    [employees]
  )

  const companyByName = useMemo(() => new Map(companies.map((c) => [c.name, c.id])), [companies])
  const companyOptions = useMemo(
    () => companies.map((c) => c.name).sort((a, b) => a.localeCompare(b)),
    [companies]
  )

  const branchNameById = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches])
  const selectedCompanyId = filters.company === ALL_VALUE ? null : (companyByName.get(filters.company) ?? null)
  const branchOptions = useMemo(() => {
    const scoped = selectedCompanyId ? branches.filter((b) => b.companyId === selectedCompanyId) : branches
    return scoped.slice().sort((a, b) => a.name.localeCompare(b.name))
  }, [branches, selectedCompanyId])

  const departmentOptions = useMemo(() => uniqueSorted(employees.map((e) => e.department)), [employees])
  const positionOptions = useMemo(() => uniqueSorted(employees.map((e) => e.position)), [employees])

  const activeCount = hasActiveOrganizationChartFilters(filters)
    ? (Object.values(filters) as string[]).filter((value) => value !== ALL_VALUE).length
    : 0

  function set<K extends keyof OrganizationChartFilters>(key: K, value: string | null) {
    onChange({ ...filters, [key]: value ?? ALL_VALUE })
  }

  /** Changing Company re-scopes which branches are valid — if the branch
   * currently selected doesn't belong to the newly chosen company (or to
   * any company, once a specific one is chosen), it's reset to "All
   * Branches" instead of silently filtering by a combination that can no
   * longer match anyone. */
  function handleCompanyChange(value: string | null) {
    const nextCompany = value ?? ALL_VALUE
    const nextCompanyId = nextCompany === ALL_VALUE ? null : (companyByName.get(nextCompany) ?? null)
    const nextScopedBranches = nextCompanyId ? branches.filter((b) => b.companyId === nextCompanyId) : branches
    const validBranchIds = new Set(nextScopedBranches.map((b) => b.id))
    const nextBranch = filters.branch !== ALL_VALUE && !validBranchIds.has(filters.branch) ? ALL_VALUE : filters.branch
    onChange({ ...filters, company: nextCompany, branch: nextBranch })
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <ListFilter className="size-3.5" strokeWidth={1.75} />
            {t("trigger")}
            {activeCount > 0 ? (
              <Badge className="ml-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
                {activeCount}
              </Badge>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-[min(90vw,28rem)] p-4">
        <div className="flex items-center justify-between pb-3">
          <p className="text-sm font-medium text-foreground">{t("trigger")}</p>
          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => onChange(defaultOrganizationChartFilters)}>
              <X className="size-3.5" strokeWidth={1.75} />
              {t("clear")}
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("company")}>
            <Select value={filters.company} onValueChange={handleCompanyChange}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string) => (value === ALL_VALUE ? t("allCompanies") : value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t("allCompanies")}</SelectItem>
                {companyOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c} ({counts.company[c] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("branch")}>
            <Select value={filters.branch} onValueChange={(v) => set("branch", v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) => (value === ALL_VALUE ? t("allBranches") : branchNameById.get(value) ?? value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t("allBranches")}</SelectItem>
                {branchOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({counts.branch[b.id] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("department")}>
            <Select value={filters.department} onValueChange={(v) => set("department", v)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string) => (value === ALL_VALUE ? t("allDepartments") : value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t("allDepartments")}</SelectItem>
                {departmentOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d} ({counts.department[d] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("position")}>
            <Select value={filters.position} onValueChange={(v) => set("position", v)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string) => (value === ALL_VALUE ? t("allPositions") : value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t("allPositions")}</SelectItem>
                {positionOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p} ({counts.position[p] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("manager")}>
            <Select value={filters.manager} onValueChange={(v) => set("manager", v)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string) => (value === ALL_VALUE ? t("allManagers") : value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t("allManagers")}</SelectItem>
                {managerNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name} ({counts.manager[name] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("employmentStatus")}>
            <Select value={filters.employmentStatus} onValueChange={(v) => set("employmentStatus", v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) =>
                    value === ALL_VALUE ? t("allStatuses") : tStatus(statusMessageKeys[value as EmploymentStatus])
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t("allStatuses")}</SelectItem>
                {employmentStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {tStatus(statusMessageKeys[status])} ({counts.employmentStatus[status] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </PopoverContent>
    </Popover>
  )
}
