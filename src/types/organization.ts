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
  company: string
  /** A real Branch id (or ALL_VALUE) — NOT a display name. Employees can
   * share a branch NAME across different companies (two offices both
   * called "Baş Ofis"), so matching by id is what keeps those from being
   * conflated; see employeeMatches in filter-tree.ts for the actual
   * comparison, against employment.branchId. */
  branch: string
  department: string
  position: string
  manager: string
  employmentStatus: string
}

/** The real Company/Branch master-data catalog (Administration module,
 * src/repositories/company-repository.ts + branch-repository.ts) — NOT
 * derived from employees.map(e => e.company/e.branch). Company's filter
 * VALUE is still the plain display-name string (same convention Department/
 * Position already use) — only its option LIST comes from the real
 * catalog. Branch's filter VALUE is the real id (see OrganizationChartFilters.
 * branch's own doc comment) now that employees actually carry a branchId
 * (src/repositories/branch-repository.ts) — scoped by companyId so a Branch
 * dropdown never shows another company's branches. */
export interface OrganizationCompanyOption {
  id: string
  name: string
}

export interface OrganizationBranchOption {
  id: string
  name: string
  companyId: string
}

