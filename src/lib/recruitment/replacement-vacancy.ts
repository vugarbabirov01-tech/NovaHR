import { getFullLegalName } from "@/lib/employees"
import { normalizeReferenceName } from "@/lib/reference-data/normalize-name"
import type { RequisitionInput } from "@/lib/recruitment/recruitment-rules"
import type { EmployeeProfile } from "@/types/employee-profile"

/**
 * The vacancy that opens when an employee leaves: the same position,
 * department and branch, one opening, reason REPLACEMENT. Department is
 * resolved from the employee's stored department name (employees keep the
 * name, vacancies keep the id); if it no longer matches a department the
 * field stays empty rather than guessing.
 */
export function buildReplacementRequisition(
  employee: EmployeeProfile,
  departments: { id: string; name: string }[]
): RequisitionInput {
  const wanted = normalizeReferenceName(employee.employment.department)
  const department = wanted ? departments.find((d) => normalizeReferenceName(d.name) === wanted) : undefined

  const terminationEvent = [...employee.employment.history].reverse().find((event) => event.type === "termination")
  const left = terminationEvent ? ` (${terminationEvent.date})` : ""

  return {
    title: employee.employment.position.trim() || "—",
    departmentId: department?.id ?? null,
    branchId: employee.employment.branchId ?? null,
    openings: 1,
    reason: "REPLACEMENT",
    description: `${getFullLegalName(employee.personal)} (${employee.employment.employeeNumber})${left}`,
  }
}
