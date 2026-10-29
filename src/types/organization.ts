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
  branch: string
  department: string
  position: string
  manager: string
  employmentStatus: string
}

/** The real Company/Branch master-data catalog (Administration module,
 * src/repositories/company-repository.ts + branch-repository.ts) — NOT
 * derived from employees.map(e => e.company/e.branch), which is what the
 * Company/Branch filter used to do and is why Branch silently never worked:
 * every real employee's employment.branch is still an empty string (no
 * import/wizard flow has ever populated it), so deriving branch options
 * from employee data alone always produced zero options. company/branch
 * filter VALUES still match against employment.company/employment.branch's
 * plain display-name strings (same convention Department/Position already
 * use) — only the option LIST now comes from the real catalog, scoped by
 * companyId so a Branch dropdown never shows another company's branches. */
export interface OrganizationCompanyOption {
  id: string
  name: string
}

export interface OrganizationBranchOption {
  id: string
  name: string
  companyId: string
}

