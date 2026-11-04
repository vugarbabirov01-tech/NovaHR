import { findAllCompanies } from "@/repositories/company-repository"
import { findAllBranches } from "@/repositories/branch-repository"
import { findAllDepartments } from "@/repositories/department-repository"
import { findAllPositions } from "@/repositories/position-repository"
import { findAllEmployees } from "@/repositories/employee-repository"
import { countBy } from "@/lib/employees"
import type { ReportRow } from "@/types/reports"

/**
 * Four org-level sources, one row per org unit — never per employee.
 * employeeCount is always pre-aggregated into a single number per unit
 * BEFORE these rows are built (via countBy / a branchId tally over
 * findAllEmployees(), called once), never a live join — so a unit's row
 * exists exactly once regardless of how many employees it has.
 *
 * Reliability differs by entity, by design (Employee has no companyId/
 * departmentId/positionId — see employee-profile.ts's own doc comment;
 * only branchId is a real relation, added in the Oct 30 branch migration):
 *  - BRANCHES matches by the real branchId relation — always correct.
 *  - COMPANIES/DEPARTMENTS/POSITIONS match by exact name string. An
 *    employee whose denormalized name no longer matches any current
 *    master-data record (e.g. the record was renamed in Administration
 *    after that employee was last saved) is counted on NEITHER unit —
 *    never misattributed to a different one — so renaming never silently
 *    inflates some other row's count.
 */

export async function fetchCompanyReportRows(): Promise<ReportRow[]> {
  const [companies, employees] = await Promise.all([findAllCompanies(), findAllEmployees()])
  const countByName = countBy(employees, (employee) => employee.employment.company)
  return companies.map((company) => ({
    companyName: company.name,
    companyCode: company.code,
    companyEmployeeCount: countByName[company.name] ?? 0,
  }))
}

export async function fetchBranchReportRows(): Promise<ReportRow[]> {
  const [branches, companies, employees] = await Promise.all([
    findAllBranches(),
    findAllCompanies(),
    findAllEmployees(),
  ])
  const companyNameById = new Map(companies.map((company) => [company.id, company.name]))
  const countByBranchId: Record<string, number> = {}
  for (const employee of employees) {
    const branchId = employee.employment.branchId
    if (!branchId) continue
    countByBranchId[branchId] = (countByBranchId[branchId] ?? 0) + 1
  }
  return branches.map((branch) => ({
    branchName: branch.name,
    branchCode: branch.code,
    branchCompanyName: companyNameById.get(branch.companyId) ?? "",
    branchEmployeeCount: countByBranchId[branch.id] ?? 0,
  }))
}

export async function fetchDepartmentReportRows(): Promise<ReportRow[]> {
  const [departments, employees] = await Promise.all([findAllDepartments(), findAllEmployees()])
  const countByName = countBy(employees, (employee) => employee.employment.department)
  return departments.map((department) => ({
    departmentName: department.name,
    departmentCode: department.code,
    departmentEmployeeCount: countByName[department.name] ?? 0,
  }))
}

export async function fetchPositionReportRows(): Promise<ReportRow[]> {
  const [positions, departments, employees] = await Promise.all([
    findAllPositions(),
    findAllDepartments(),
    findAllEmployees(),
  ])
  const departmentNameById = new Map(departments.map((department) => [department.id, department.name]))
  const countByTitle = countBy(employees, (employee) => employee.employment.position)
  return positions.map((position) => ({
    positionTitle: position.title,
    positionCode: position.code,
    positionDepartmentName: departmentNameById.get(position.departmentId) ?? "",
    positionEmployeeCount: countByTitle[position.title] ?? 0,
  }))
}
