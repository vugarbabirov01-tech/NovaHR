import type { EmployeeListItem } from "@/types/employee-profile"

/**
 * One node of the Organization Chart — always built from real
 * EmployeeListItem data (src/lib/organization/build-tree.ts), never
 * hand-authored. `descendantCount` is computed once, bottom-up, at build
 * time (not re-derived per render) — see buildOrganizationTree's own doc
 * comment for why.
 */
export interface OrganizationTreeNode {
  employee: EmployeeListItem
  children: OrganizationTreeNode[]
  /** Every employee anywhere below this node, at any depth — not just
   * direct reports. Zero for an individual contributor with no reports. */
  descendantCount: number
}

/** Every field holds either a real value or ALL_VALUE (types/employee-
 * filters.ts) for "no filter" — same convention the Employee List's own
 * filters already use, so the two features stay consistent even though
 * each owns its own state. */
export interface OrganizationChartFilters {
  department: string
  position: string
  manager: string
  employmentStatus: string
}

