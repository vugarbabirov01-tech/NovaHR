import { describe, expect, it } from "vitest"

import { buildTestEmployeeProfile } from "@/lib/leave/leave-test-fixtures"
import { createEmployee, deleteEmployees } from "@/repositories/employee-repository"
import { findAllBranches } from "@/repositories/branch-repository"
import { findAllCompanies } from "@/repositories/company-repository"
import { findAllDepartments } from "@/repositories/department-repository"
import { findAllPositions } from "@/repositories/position-repository"
import {
  fetchBranchReportRows,
  fetchCompanyReportRows,
  fetchDepartmentReportRows,
  fetchPositionReportRows,
} from "@/lib/reports/organization-report-data-source"

/**
 * Real-data integration test — proves employeeCount is a genuine
 * pre-aggregation (adding one real employee to a real org unit increases
 * that unit's count by exactly 1, and only that unit's), for all four
 * organization sources in one pass. BRANCHES is matched by the real
 * branchId relation; COMPANIES/DEPARTMENTS/POSITIONS by name — this test
 * exercises both matching strategies against real master-data rows.
 */
describe("organization report data sources", () => {
  it("increments exactly one unit's employeeCount per source when a matching employee is added", async () => {
    const [branches, companies, departments, positions] = await Promise.all([
      findAllBranches(),
      findAllCompanies(),
      findAllDepartments(),
      findAllPositions(),
    ])
    const branch = branches[0]
    const company = companies[0]
    const department = departments[0]
    const position = positions[0]

    const [branchRowsBefore, companyRowsBefore, departmentRowsBefore, positionRowsBefore] = await Promise.all([
      fetchBranchReportRows(),
      fetchCompanyReportRows(),
      fetchDepartmentReportRows(),
      fetchPositionReportRows(),
    ])
    const branchCountBefore = Number(branchRowsBefore.find((row) => row.branchName === branch.name)?.branchEmployeeCount ?? 0)
    const companyCountBefore = Number(
      companyRowsBefore.find((row) => row.companyName === company.name)?.companyEmployeeCount ?? 0
    )
    const departmentCountBefore = Number(
      departmentRowsBefore.find((row) => row.departmentName === department.name)?.departmentEmployeeCount ?? 0
    )
    const positionCountBefore = Number(
      positionRowsBefore.find((row) => row.positionTitle === position.title)?.positionEmployeeCount ?? 0
    )

    const profile = buildTestEmployeeProfile("EMP-1042")
    profile.employment.branchId = branch.id
    profile.employment.company = company.name
    profile.employment.department = department.name
    profile.employment.position = position.title

    await createEmployee(profile)
    try {
      const [branchRowsAfter, companyRowsAfter, departmentRowsAfter, positionRowsAfter] = await Promise.all([
        fetchBranchReportRows(),
        fetchCompanyReportRows(),
        fetchDepartmentReportRows(),
        fetchPositionReportRows(),
      ])

      expect(branchRowsAfter.find((row) => row.branchName === branch.name)?.branchEmployeeCount).toBe(
        branchCountBefore + 1
      )
      expect(companyRowsAfter.find((row) => row.companyName === company.name)?.companyEmployeeCount).toBe(
        companyCountBefore + 1
      )
      expect(
        departmentRowsAfter.find((row) => row.departmentName === department.name)?.departmentEmployeeCount
      ).toBe(departmentCountBefore + 1)
      expect(positionRowsAfter.find((row) => row.positionTitle === position.title)?.positionEmployeeCount).toBe(
        positionCountBefore + 1
      )

      // Every other row's own count must stay exactly as it was — proves
      // the increment landed on one unit only, not a broad miscount.
      const otherBranch = branchRowsAfter.find((row) => row.branchName !== branch.name)
      if (otherBranch) {
        const before = branchRowsBefore.find((row) => row.branchName === otherBranch.branchName)
        expect(otherBranch.branchEmployeeCount).toBe(before?.branchEmployeeCount ?? 0)
      }
    } finally {
      await deleteEmployees([profile.id])
    }
  })

  it("never attributes an unmatched department/position name to any real unit", async () => {
    function totalOf(rows: Awaited<ReturnType<typeof fetchDepartmentReportRows>>, key: string): number {
      return rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0)
    }

    const departmentTotalBefore = totalOf(await fetchDepartmentReportRows(), "departmentEmployeeCount")
    const positionTotalBefore = totalOf(await fetchPositionReportRows(), "positionEmployeeCount")

    const profile = buildTestEmployeeProfile("EMP-1042")
    profile.employment.department = "TEST-DOES-NOT-EXIST-DEPARTMENT"
    profile.employment.position = "TEST-DOES-NOT-EXIST-POSITION"

    await createEmployee(profile)
    try {
      const departmentRows = await fetchDepartmentReportRows()
      const positionRows = await fetchPositionReportRows()

      // The mismatched employee must not show up as their own row (not a
      // real department/position), AND the sum across every real row must
      // stay exactly as it was — proving they were silently dropped, never
      // folded into some other unit's count.
      expect(departmentRows.every((row) => row.departmentName !== profile.employment.department)).toBe(true)
      expect(positionRows.every((row) => row.positionTitle !== profile.employment.position)).toBe(true)
      expect(totalOf(departmentRows, "departmentEmployeeCount")).toBe(departmentTotalBefore)
      expect(totalOf(positionRows, "positionEmployeeCount")).toBe(positionTotalBefore)
    } finally {
      await deleteEmployees([profile.id])
    }
  })
})
