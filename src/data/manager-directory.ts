// Lean, read-only projection of the employee directory for the Manager
// autocomplete — only the fields a search/select needs, never the full
// profile. Does not modify employee-directory.ts in any way.

import { findAllEmployees } from "@/repositories/employee-repository"
import { getFullName } from "@/lib/employees"

export interface ManagerOption {
  id: string
  name: string
  position: string
}

/**
 * Reads fresh from the Employee table every call — never cached — so a
 * termination is reflected immediately: a terminated employee can no
 * longer be anyone's manager going forward, excluded here, at the single
 * source every manager selector reads from, rather than in each individual
 * consumer.
 */
export async function getManagerOptions(): Promise<ManagerOption[]> {
  const employees = await findAllEmployees()
  return employees
    .filter((employee) => employee.employmentStatus !== "terminated")
    .map((employee) => ({
      id: employee.id,
      name: getFullName(employee.personal),
      position: employee.employment.position,
    }))
}
