import { getFullName } from "@/lib/employees"
import type { EmployeeListItem } from "@/types/employee-profile"
import type { OrganizationTreeNode } from "@/types/organization"

/**
 * The one place employee-manager data (EmployeeListItem.managerId) becomes
 * a tree. No other module may hand-build or hardcode a hierarchy — every
 * Organization Chart surface (the compact page view and the Full Chart
 * dialog) renders whatever this returns.
 *
 * Root employees are anyone with no managerId, OR whose managerId doesn't
 * resolve to another employee in this same list (a manager who left, or
 * simply wasn't included in a filtered/scoped call) — never dropped
 * silently, since that would make part of the org invisible.
 *
 * descendantCount is computed once here, bottom-up (post-order: children
 * are fully sized before their parent adds them up), not recomputed by
 * whatever renders the tree — the exact "cache the recursive count instead
 * of re-deriving it on every render" this feature's perf requirement asks
 * for. A defensive `visiting` guard breaks any managerId cycle a future
 * bad edit could introduce (A reports to B, B reports to A) rather than
 * recursing forever — a cycle member is treated as a root instead.
 */
export function buildOrganizationTree(employees: EmployeeListItem[]): OrganizationTreeNode[] {
  const byId = new Map(employees.map((employee) => [employee.id, employee]))
  const childrenByManagerId = new Map<string, EmployeeListItem[]>()
  const rootEmployees: EmployeeListItem[] = []

  for (const employee of employees) {
    const managerId = employee.managerId
    if (managerId && byId.has(managerId) && managerId !== employee.id) {
      const siblings = childrenByManagerId.get(managerId)
      if (siblings) siblings.push(employee)
      else childrenByManagerId.set(managerId, [employee])
    } else {
      rootEmployees.push(employee)
    }
  }

  function byName(a: EmployeeListItem, b: EmployeeListItem): number {
    return getFullName(a).localeCompare(getFullName(b))
  }

  function buildNode(employee: EmployeeListItem, visiting: ReadonlySet<string>): OrganizationTreeNode {
    if (visiting.has(employee.id)) {
      // managerId cycle — stop descending here rather than recursing
      // forever; this employee still renders, just as a childless leaf.
      return { employee, children: [], descendantCount: 0 }
    }
    const nextVisiting = new Set(visiting)
    nextVisiting.add(employee.id)

    const children = (childrenByManagerId.get(employee.id) ?? [])
      .slice()
      .sort(byName)
      .map((child) => buildNode(child, nextVisiting))

    const descendantCount = children.reduce((sum, child) => sum + 1 + child.descendantCount, 0)

    return { employee, children, descendantCount }
  }

  return rootEmployees
    .slice()
    .sort(byName)
    .map((employee) => buildNode(employee, new Set()))
}

/** Every node in the tree, flattened — used by search/filter to test each
 * employee once rather than re-walking the tree per predicate. */
export function flattenOrganizationTree(nodes: OrganizationTreeNode[]): OrganizationTreeNode[] {
  const result: OrganizationTreeNode[] = []
  function visit(node: OrganizationTreeNode) {
    result.push(node)
    for (const child of node.children) visit(child)
  }
  for (const node of nodes) visit(node)
  return result
}

/**
 * The Employee Profile page's "Organizational Hierarchy" card — the
 * reporting chain from the company's top down to `employeeId`, inclusive,
 * each with its real descendantCount already computed by the tree above
 * (never a separately-counted "direct reports" figure, so the two features
 * can never disagree). Walks employee.managerId upward independently of
 * the tree's own parent/child structure, with its own `visited` guard —
 * buildOrganizationTree's cycle protection only covers descending through
 * `children`, not this upward walk, so a managerId cycle here needs its
 * own stop condition or it would loop forever. A managerId that doesn't
 * resolve to another employee in `employees` (already left the company, or
 * simply wasn't included in a scoped call) just ends the chain there
 * rather than throwing — the chain renders however far it can be traced.
 */
export function buildManagerChain(employeeId: string, employees: EmployeeListItem[]): OrganizationTreeNode[] {
  const byId = new Map(employees.map((employee) => [employee.id, employee]))
  if (!byId.has(employeeId)) return []

  const tree = buildOrganizationTree(employees)
  const nodeById = new Map(flattenOrganizationTree(tree).map((node) => [node.employee.id, node]))

  const chainIdsBottomUp: string[] = []
  const visited = new Set<string>()
  let currentId: string | undefined = employeeId
  while (currentId && byId.has(currentId) && !visited.has(currentId)) {
    visited.add(currentId)
    chainIdsBottomUp.push(currentId)
    currentId = byId.get(currentId)!.managerId
  }

  return chainIdsBottomUp
    .reverse()
    .map((id) => nodeById.get(id))
    .filter((node): node is OrganizationTreeNode => node !== undefined)
}

/** employeeId -> the chain of ancestor ids from the root down to (but not
 * including) that employee — what Search/Filter expand along to reveal a
 * match. Built once per tree, alongside the flattened list. */
export function buildAncestorPathsById(nodes: OrganizationTreeNode[]): Map<string, string[]> {
  const paths = new Map<string, string[]>()
  function visit(node: OrganizationTreeNode, ancestors: string[]) {
    paths.set(node.employee.id, ancestors)
    const nextAncestors = [...ancestors, node.employee.id]
    for (const child of node.children) visit(child, nextAncestors)
  }
  for (const node of nodes) visit(node, [])
  return paths
}
