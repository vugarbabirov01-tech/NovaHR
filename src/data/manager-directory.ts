// Lean, read-only projection of the employee directory for the Manager
// autocomplete — only the fields a search/select needs, never the full
// profile. Does not modify employee-directory.ts in any way.

import { employeeDirectory } from "@/data/employee-directory"
import { getFullName } from "@/lib/employees"

export interface ManagerOption {
  id: string
  name: string
  position: string
}

/**
 * A function, not a computed-once constant — employeeDirectory is mutated in
 * place (hires, terminations) over the life of the process, and a plain
 * `const` snapshot taken at first import would never see those changes. A
 * terminated employee can no longer be anyone's manager going forward —
 * excluded here, at the single source every manager selector reads from,
 * rather than in each individual consumer.
 */
export function getManagerOptions(): ManagerOption[] {
  return employeeDirectory
    .filter((employee) => employee.employmentStatus !== "terminated")
    .map((employee) => ({
      id: employee.id,
      name: getFullName(employee.personal),
      position: employee.employment.position,
    }))
}
