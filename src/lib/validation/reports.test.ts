import { describe, expect, it } from "vitest"

import { reportDefinitionInputSchema, reportPreviewInputSchema } from "@/lib/validation/reports"

const validEmployeesReport = {
  name: "Test report",
  dataSource: "EMPLOYEES" as const,
  columns: ["firstName", "lastName"],
  filters: [{ field: "employmentStatus", operator: "equals" as const, value: "active" }],
  sortBy: "firstName",
  sortDirection: "asc" as const,
}

describe("reportDefinitionInputSchema", () => {
  it("accepts a well-formed, single-source report", () => {
    expect(reportDefinitionInputSchema.safeParse(validEmployeesReport).success).toBe(true)
  })

  it("accepts every newly added Phase 2 data source", () => {
    const cases = [
      { dataSource: "COMPANIES", columns: ["companyName"] },
      { dataSource: "BRANCHES", columns: ["branchName"] },
      { dataSource: "DEPARTMENTS", columns: ["departmentName"] },
      { dataSource: "POSITIONS", columns: ["positionTitle"] },
      { dataSource: "LEAVE_REQUESTS", columns: ["leaveTypeName"] },
    ] as const
    for (const { dataSource, columns } of cases) {
      const result = reportDefinitionInputSchema.safeParse({
        ...validEmployeesReport,
        dataSource,
        columns,
        filters: [],
        sortBy: null,
      })
      expect(result.success).toBe(true)
    }
  })

  it("rejects a column that belongs to a different data source than declared", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      dataSource: "EMPLOYEES",
      columns: ["firstName", "leaveStatus"], // leaveStatus belongs to LEAVE_REQUESTS
      filters: [],
    })
    expect(result.success).toBe(false)
  })

  it("rejects a filter field that belongs to a different data source than declared", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      dataSource: "EMPLOYEES",
      filters: [{ field: "payrollStatus", operator: "equals", value: "PAID" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects a sortBy field that belongs to a different data source than declared", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      dataSource: "EMPLOYEES",
      sortBy: "branchEmployeeCount",
      filters: [],
    })
    expect(result.success).toBe(false)
  })

  it("rejects an operator the field's type does not support", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      filters: [{ field: "hireDate", operator: "contains", value: "2020" }],
    })
    expect(result.success).toBe(false)
  })
})

describe("reportPreviewInputSchema", () => {
  it("applies the same cross-data-source check as the save schema", () => {
    const result = reportPreviewInputSchema.safeParse({
      dataSource: "LEAVE_REQUESTS",
      columns: ["leaveTypeName", "company"], // "company" belongs to EMPLOYEES
      filters: [],
    })
    expect(result.success).toBe(false)
  })
})
