import type { OrganizationTreeNode } from "@/types/organization"

export interface OrganizationCompanyGroup {
  company: string
  roots: OrganizationTreeNode[]
}

/**
 * Groups the tree's own ROOT nodes by each root employee's real
 * employment.company — never a structural change to buildOrganizationTree
 * itself, just how its output is sectioned for display. With today's one
 * real company this returns exactly one group (so both the List view and
 * the new Chart canvas render precisely as they did before this existed);
 * the moment a second company's employees exist, their root executives
 * render under their own heading instead of interleaved with the first
 * company's, which is what "don't mix companies' structures" actually
 * means here — buildOrganizationTree already never lets a managerId chain
 * jump between an employee's own subtree and an unrelated one, so grouping
 * the roots is the one place company separation needs to be enforced.
 * Groups are sorted by company name; a root with no company set falls
 * under the empty string.
 */
export function groupTreeRootsByCompany(tree: OrganizationTreeNode[]): OrganizationCompanyGroup[] {
  const rootsByCompany = new Map<string, OrganizationTreeNode[]>()

  for (const root of tree) {
    const company = root.employee.company
    const existing = rootsByCompany.get(company)
    if (existing) existing.push(root)
    else rootsByCompany.set(company, [root])
  }

  return Array.from(rootsByCompany, ([company, roots]) => ({ company, roots })).sort((a, b) =>
    a.company.localeCompare(b.company)
  )
}
