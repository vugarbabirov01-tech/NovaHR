import type { OrganizationTreeNode } from "@/types/organization"
import type { EmployeeListItem } from "@/types/employee-profile"

export interface SplitRootsResult {
  /** Roots that actually head a real reporting chain (children.length > 0),
   * plus any root explicitly designated isTopExecutive — a company's real
   * top leader legitimately has no manager and may have no direct reports
   * recorded either, but is not an "unassigned" data gap. These are what
   * the canvas renders. */
  hierarchyRoots: OrganizationTreeNode[]
  /** Roots with no manager, no one reporting to them, and not designated
   * isTopExecutive — a standalone employee, not a hierarchy of one.
   * Rendering these as canvas "roots" is what produced the one giant flat
   * row of tiny cards (131 of today's real 237 employees have no managerId,
   * only 4 of them actually manage anyone) — so they're pulled out into
   * their own searchable, assignable list (UnassignedEmployeesPanel)
   * instead of cluttering the chart. */
  unassigned: EmployeeListItem[]
}

export function splitUnassignedRoots(roots: OrganizationTreeNode[]): SplitRootsResult {
  const hierarchyRoots: OrganizationTreeNode[] = []
  const unassigned: EmployeeListItem[] = []

  for (const root of roots) {
    if (root.children.length > 0 || root.employee.isTopExecutive) hierarchyRoots.push(root)
    else unassigned.push(root.employee)
  }

  return { hierarchyRoots, unassigned }
}
