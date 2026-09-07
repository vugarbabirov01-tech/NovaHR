import { buildAncestorPathsById, flattenOrganizationTree } from "@/lib/organization/build-tree"
import { getFullName } from "@/lib/employees"
import { ALL_VALUE } from "@/types/employee-filters"
import type { OrganizationTreeNode, OrganizationChartFilters } from "@/types/organization"

export const defaultOrganizationChartFilters: OrganizationChartFilters = {
  department: ALL_VALUE,
  position: ALL_VALUE,
  manager: ALL_VALUE,
  employmentStatus: ALL_VALUE,
}

export function hasActiveOrganizationChartFilters(filters: OrganizationChartFilters): boolean {
  return (Object.values(filters) as string[]).some((value) => value !== ALL_VALUE)
}

/** One employee against the current search text + filter selections — the
 * single predicate Search (§8) and the Department/Position/Manager/Status
 * filter (§9) both go through, so "does this row match" can never be
 * defined two different ways. */
function employeeMatches(
  employee: OrganizationTreeNode["employee"],
  normalizedQuery: string,
  filters: OrganizationChartFilters
): boolean {
  if (filters.department !== ALL_VALUE && employee.department !== filters.department) return false
  if (filters.position !== ALL_VALUE && employee.position !== filters.position) return false
  if (filters.manager !== ALL_VALUE && employee.managerName !== filters.manager) return false
  if (filters.employmentStatus !== ALL_VALUE && employee.employmentStatus !== filters.employmentStatus) return false

  if (!normalizedQuery) return true
  const haystack = [getFullName(employee), employee.finCode, employee.position, employee.department]
    .join(" ")
    .toLowerCase()
  return haystack.includes(normalizedQuery)
}

export interface OrganizationChartVisibilityResult {
  /** null = show the tree under normal expand/collapse rules (no active
   * search/filter to narrow it). */
  visibleIds: Set<string> | null
  forceExpandIds: Set<string>
  matchedIds: Set<string>
}

/**
 * Search (§8) and the Department/Position/Manager/Status filter (§9) are
 * the same mechanism: find every matching employee, then keep their whole
 * ancestor chain visible and expanded so the hierarchy is never broken —
 * "CEO -> Director -> Manager -> Employee" auto-expands to reveal a match,
 * a filtered department's employees still show their parent managers for
 * context. A non-matching branch with no matching descendant is pruned
 * entirely rather than shown empty.
 */
export function computeOrganizationChartVisibility(
  tree: OrganizationTreeNode[],
  query: string,
  filters: OrganizationChartFilters
): OrganizationChartVisibilityResult {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery && !hasActiveOrganizationChartFilters(filters)) {
    return { visibleIds: null, forceExpandIds: new Set(), matchedIds: new Set() }
  }

  const matchedIds = new Set<string>()
  for (const node of flattenOrganizationTree(tree)) {
    if (employeeMatches(node.employee, normalizedQuery, filters)) matchedIds.add(node.employee.id)
  }

  const ancestorPaths = buildAncestorPathsById(tree)
  const visibleIds = new Set<string>()
  const forceExpandIds = new Set<string>()
  for (const id of matchedIds) {
    visibleIds.add(id)
    for (const ancestorId of ancestorPaths.get(id) ?? []) {
      visibleIds.add(ancestorId)
      forceExpandIds.add(ancestorId)
    }
  }

  return { visibleIds, forceExpandIds, matchedIds }
}
