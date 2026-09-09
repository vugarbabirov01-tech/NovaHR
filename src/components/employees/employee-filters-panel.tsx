"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { ListFilter, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field } from "@/components/common/field"
import { countBy, employmentTypeMessageKeys } from "@/lib/employees"
import { ALL_VALUE, defaultEmployeeFilters, type EmployeeFilters } from "@/types/employee-filters"
import type { EmployeeListItem, EmploymentType } from "@/types/employee-profile"

// The full closed set from the EmploymentType union itself, not master data
// — every value is always offered (even at 0 results) same as every other
// enum filter in the app. Company/department/position/work location below
// are the opposite: open-ended catalogs, so their options are derived from
// `employees` instead of listed here.
const employmentTypes: EmploymentType[] = [
  "full-time",
  "part-time",
  "seasonal",
  "temporary",
  "contract",
  "internship",
]

interface EmployeeFiltersPanelProps {
  /** The same list EmployeeCard/EmployeeListTable render from, already
   * narrowed to the current Status filter (see employee-list-client.tsx) —
   * every option, count and match below reads company/department/position/
   * workLocation/managerId straight off these records, never a separate
   * catalog, so a filter option can never show something a card doesn't. */
  employees: EmployeeListItem[]
  filters: EmployeeFilters
  onChange: (filters: EmployeeFilters) => void
}

function uniqueSorted(values: (string | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort((a, b) => a.localeCompare(b))
}

export function EmployeeFiltersPanel({
  employees,
  filters,
  onChange,
}: EmployeeFiltersPanelProps) {
  const t = useTranslations("Employees.list")
  const tType = useTranslations("EmploymentType")
  // The "Advanced Filters" popover's own open state — deliberately separate
  // from each <Select>'s internal dropdown-open state below. A Select's
  // onValueChange only fires once an option is actually picked (browsing
  // its list never fires it), so closing the popover from inside `set()`
  // can never trigger while a dropdown is merely open.
  const [open, setOpen] = useState(false)

  const counts = useMemo(
    () => ({
      company: countBy(employees, (e) => e.company),
      workLocation: countBy(employees, (e) => e.workLocation),
      department: countBy(employees, (e) => e.department),
      position: countBy(employees, (e) => e.position),
      manager: countBy(employees, (e) => e.managerId),
      employmentType: countBy(employees, (e) => e.employmentType),
    }),
    [employees]
  )

  const companyOptions = useMemo(() => uniqueSorted(employees.map((e) => e.company)), [employees])
  const workLocationOptions = useMemo(() => uniqueSorted(employees.map((e) => e.workLocation)), [employees])
  const departmentOptions = useMemo(() => uniqueSorted(employees.map((e) => e.department)), [employees])
  const positionOptions = useMemo(() => uniqueSorted(employees.map((e) => e.position)), [employees])

  // Managers are matched by managerId, not managerName — two different
  // managers can share a name, and only the id is guaranteed unique.
  const managerOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const e of employees) {
      if (e.managerId && e.managerName) byId.set(e.managerId, e.managerName)
    }
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [employees])

  // employmentStatus is owned by the primary Status filter and smartFilter
  // by the Smart Filters panel, not this popover — excluded from both the
  // count and "Clear filters" below.
  const activeCount = (
    Object.entries(filters) as [keyof EmployeeFilters, string][]
  ).filter(
    ([key, value]) => key !== "search" && key !== "employmentStatus" && key !== "smartFilter" && value !== ALL_VALUE
  ).length

  function set<K extends keyof EmployeeFilters>(key: K, value: string | null) {
    onChange({ ...filters, [key]: value ?? ALL_VALUE })
    setOpen(false)
  }

  function clear() {
    onChange({
      ...defaultEmployeeFilters,
      search: filters.search,
      employmentStatus: filters.employmentStatus,
      smartFilter: filters.smartFilter,
    })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <ListFilter className="size-3.5" strokeWidth={1.75} />
            {t("advancedFilters")}
            {activeCount > 0 ? (
              <Badge className="ml-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
                {activeCount}
              </Badge>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-[min(90vw,34rem)] p-4">
        <div className="flex items-center justify-between pb-3">
          <p className="text-sm font-medium text-foreground">{t("advancedFilters")}</p>
          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={clear}>
              <X className="size-3.5" strokeWidth={1.75} />
              {t("clearFilters")}
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("company")}>
            <Select value={filters.company} onValueChange={(v) => set("company", v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) => (value === ALL_VALUE ? t("allCompanies") : value)}
                </SelectValue>
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
          <Field label={t("workLocation")}>
            <Select value={filters.workLocation} onValueChange={(v) => set("workLocation", v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) => (value === ALL_VALUE ? t("allWorkLocations") : value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t("allWorkLocations")}</SelectItem>
                {workLocationOptions.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w} ({counts.workLocation[w] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("department")}>
            <Select value={filters.department} onValueChange={(v) => set("department", v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) => (value === ALL_VALUE ? t("allDepartments") : value)}
                </SelectValue>
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
                <SelectValue>
                  {(value: string) => (value === ALL_VALUE ? t("allPositions") : value)}
                </SelectValue>
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
                <SelectValue>
                  {(value: string) =>
                    value === ALL_VALUE
                      ? t("allManagers")
                      : (managerOptions.find((m) => m.id === value)?.name ?? value)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t("allManagers")}</SelectItem>
                {managerOptions.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.name} ({counts.manager[manager.id] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("employmentType")}>
            <Select value={filters.employmentType} onValueChange={(v) => set("employmentType", v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) =>
                    value === ALL_VALUE
                      ? t("allTypes")
                      : tType(employmentTypeMessageKeys[value as EmploymentType])
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t("allTypes")}</SelectItem>
                {employmentTypes.map((et) => (
                  <SelectItem key={et} value={et}>
                    {tType(employmentTypeMessageKeys[et])} ({counts.employmentType[et] ?? 0})
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
