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

export const managerOptions: ManagerOption[] = employeeDirectory.map((employee) => ({
  id: employee.id,
  name: getFullName(employee.personal),
  position: employee.employment.position,
}))
