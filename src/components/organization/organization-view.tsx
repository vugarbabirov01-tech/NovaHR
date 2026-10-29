"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { SearchInput } from "@/components/common/search-input"
import { OrgChartFilters } from "@/components/organization/org-chart-filters"
import { OrgChartClient } from "@/components/organization/org-chart-client"
import { OrgChartCanvas } from "@/components/organization/org-chart-canvas"
import { UnassignedEmployeesPanel } from "@/components/organization/unassigned-employees-panel"
import { OrganizationViewToggle, type OrganizationView as ViewMode } from "@/components/organization/organization-view-toggle"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { groupTreeRootsByCompany } from "@/lib/organization/group-by-company"
import { splitUnassignedRoots } from "@/lib/organization/split-unassigned"
import { defaultOrganizationChartFilters } from "@/lib/organization/filter-tree"
import type {
  OrganizationBranchOption,
  OrganizationChartFilters,
  OrganizationCompanyOption,
  OrganizationTreeNode,
} from "@/types/organization"
import type { EmployeeListItem } from "@/types/employee-profile"

interface OrganizationViewProps {
  tree: OrganizationTreeNode[]
  employees: EmployeeListItem[]
  managerNames: string[]
  companies: OrganizationCompanyOption[]
  branches: OrganizationBranchOption[]
}

/**
 * The page-level wrapper: owns the Chart ↔ List toggle and the one
 * Search/Filter state both views share. List mode renders the existing
 * OrgChartClient exactly as before (its own Card, its own search bar, its
 * own "Full Chart" button) — nothing about it changed visually, it just
 * now reads/writes this lifted state instead of its own. Chart mode is new:
 * its own search/filter bar, then one OrgChartCanvas per real company
 * (group-by-company.ts) — today that's a single group (one real company),
 * so this renders one canvas with no heading; a second company's employees
 * would get their own heading + canvas rather than a visually mixed tree.
 */
export function OrganizationView({ tree, employees, managerNames, companies, branches }: OrganizationViewProps) {
  const t = useTranslations("OrganizationChart")
  const [view, setView] = usePersistedState<ViewMode>("organization-view", "chart")
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<OrganizationChartFilters>(defaultOrganizationChartFilters)

  const companyGroups = groupTreeRootsByCompany(tree)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <OrganizationViewToggle value={view} onChange={setView} />
      </div>

      {view === "list" ? (
        <OrgChartClient
          tree={tree}
          employees={employees}
          managerNames={managerNames}
          companies={companies}
          branches={branches}
          query={query}
          onQueryChange={setQuery}
          filters={filters}
          onFiltersChange={setFilters}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              placeholder={t("searchPlaceholder")}
              containerClassName="w-full sm:max-w-xs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <OrgChartFilters
              employees={employees}
              managerNames={managerNames}
              companies={companies}
              branches={branches}
              filters={filters}
              onChange={setFilters}
            />
          </div>

          {companyGroups.map((group) => {
            const { hierarchyRoots, unassigned } = splitUnassignedRoots(group.roots)
            return (
              <div key={group.company || "none"} className="flex flex-col gap-4">
                {companyGroups.length > 1 ? (
                  <h2 className="text-sm font-medium text-foreground">{group.company || t("noCompany")}</h2>
                ) : null}
                <OrgChartCanvas
                  roots={hierarchyRoots}
                  employees={employees}
                  query={query}
                  filters={filters}
                  exportFileName={companyGroups.length > 1 ? `organization-chart-${group.company}` : "organization-chart"}
                />
                <UnassignedEmployeesPanel
                  employees={unassigned}
                  allEmployees={employees}
                  query={query}
                  filters={filters}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
