"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { ListFilter, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field } from "@/components/common/field"
import { departments, positions } from "@/data/employee-options"
import { countBy, statusMessageKeys } from "@/lib/employees"
import { ALL_VALUE } from "@/types/employee-filters"
import { defaultOrganizationChartFilters, hasActiveOrganizationChartFilters } from "@/lib/organization/filter-tree"
import type { OrganizationChartFilters } from "@/types/organization"
import type { EmployeeListItem, EmploymentStatus } from "@/types/employee-profile"

const employmentStatuses: EmploymentStatus[] = ["active", "probation", "suspended", "terminated", "inactive"]

interface OrgChartFiltersProps {
  employees: EmployeeListItem[]
  managerNames: string[]
  filters: OrganizationChartFilters
  onChange: (filters: OrganizationChartFilters) => void
}

/** Department/Position/Manager/Employment-status — §9. Same Popover +
 * Select layout as EmployeeFiltersPanel (employee-filters-panel.tsx), a
 * dedicated instance rather than a shared component since each screen owns
 * its own filter shape, matching how this codebase already treats Leave's
 * and Employees' filter panels as independent despite the visual overlap. */
export function OrgChartFilters({ employees, managerNames, filters, onChange }: OrgChartFiltersProps) {
  const t = useTranslations("OrganizationChart.filters")
  const tStatus = useTranslations("Status")

  const counts = useMemo(
    () => ({
      department: countBy(employees, (e) => e.department),
      position: countBy(employees, (e) => e.position),
      manager: countBy(employees, (e) => e.managerName),
      employmentStatus: countBy(employees, (e) => e.employmentStatus),
    }),
    [employees]
  )

  const activeCount = hasActiveOrganizationChartFilters(filters)
    ? (Object.values(filters) as string[]).filter((value) => value !== ALL_VALUE).length
    : 0

  function set<K extends keyof OrganizationChartFilters>(key: K, value: string | null) {
    onChange({ ...filters, [key]: value ?? ALL_VALUE })
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
          <Field label={t("department")}>
            <Select value={filters.department} onValueChange={(v) => set("department", v)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string) => (value === ALL_VALUE ? t("allDepartments") : value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t("allDepartments")}</SelectItem>
                {departments.map((d) => (
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
                {positions.map((p) => (
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
