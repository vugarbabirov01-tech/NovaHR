"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Maximize2, Network } from "lucide-react"

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/common/search-input"
import { EmptyState } from "@/components/common/empty-state"
import { OrgChartNode } from "@/components/organization/org-chart-node"
import { OrgChartFilters } from "@/components/organization/org-chart-filters"
import { FullChartDialog } from "@/components/organization/full-chart-dialog"
import { computeOrganizationChartVisibility, defaultOrganizationChartFilters } from "@/lib/organization/filter-tree"
import type { OrganizationTreeNode, OrganizationChartFilters } from "@/types/organization"
import type { EmployeeListItem } from "@/types/employee-profile"

interface OrgChartClientProps {
  tree: OrganizationTreeNode[]
  employees: EmployeeListItem[]
  managerNames: string[]
}

/**
 * The Organization Chart's compact page view — always built from the real
 * employeeDirectory-derived tree the Server Component passed down (see
 * organization/page.tsx), never a hand-authored shape. Roots render
 * collapsed by default ("Əsas rəhbərlər görünür, alt struktur mümkün qədər
 * kompakt saxlanılır"); Search/Filter and "Full Chart" reuse the exact same
 * OrgChartNode renderer this uses, so the three surfaces can never drift
 * apart visually.
 */
export function OrgChartClient({ tree, employees, managerNames }: OrgChartClientProps) {
  const t = useTranslations("OrganizationChart")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<OrganizationChartFilters>(defaultOrganizationChartFilters)
  const [isFullChartOpen, setIsFullChartOpen] = useState(false)

  const visibility = useMemo(
    () => computeOrganizationChartVisibility(tree, query, filters),
    [tree, query, filters]
  )

  const visibleRoots = tree.filter(
    (node) => visibility.visibleIds === null || visibility.visibleIds.has(node.employee.id)
  )

  function toggle(employeeId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => setIsFullChartOpen(true)}>
            <Maximize2 className="size-3.5" strokeWidth={1.75} />
            {t("fullChart")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder={t("searchPlaceholder")}
            containerClassName="w-full sm:max-w-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <OrgChartFilters employees={employees} managerNames={managerNames} filters={filters} onChange={setFilters} />
        </div>

        {tree.length === 0 ? (
          <EmptyState icon={Network} title={t("noData")} description={t("noDataDescription")} />
        ) : visibleRoots.length === 0 ? (
          <EmptyState icon={Network} title={t("noResults")} description={t("noResultsDescription")} />
        ) : (
          <div className="overflow-x-auto">
            <div className="flex min-w-fit flex-col gap-1">
              {visibleRoots.map((node) => (
                <OrgChartNode
                  key={node.employee.id}
                  node={node}
                  expandedIds={expandedIds}
                  onToggle={toggle}
                  visibility={visibility}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {isFullChartOpen ? (
        <FullChartDialog
          open={isFullChartOpen}
          onOpenChange={setIsFullChartOpen}
          tree={tree}
          employees={employees}
          managerNames={managerNames}
          initialExpandedIds={expandedIds}
          initialQuery={query}
          initialFilters={filters}
        />
      ) : null}
    </Card>
  )
}
