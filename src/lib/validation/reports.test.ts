import { describe, expect, it } from "vitest"

import {
  isPivotSpecValidForDataSource,
  pivotSpecSchema,
  reportDefinitionInputSchema,
  reportPreviewInputSchema,
} from "@/lib/validation/reports"

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

// Universal analytics (2026-11-11) — kpis/chartConfig validation. Every
// case here is deliberately expressed in terms of real field-registry
// entries (age, department, payrollYear, ...) rather than synthetic keys,
// so a future registry edit that removes/renames one of these fields
// surfaces as a real test failure, not a silently-stale assertion.
describe("reportDefinitionInputSchema — kpis", () => {
  it("accepts a KPI whose field allows the requested aggregation", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      kpis: [{ aggregation: "avg", valueField: "age" }],
    })
    expect(result.success).toBe(true)
  })

  it("rejects a KPI field that belongs to a different data source", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      kpis: [{ aggregation: "sum", valueField: "leaveRequestedUnits" }], // LEAVE_REQUESTS field
    })
    expect(result.success).toBe(false)
  })

  it("rejects an aggregation the field's own registry entry does not allow (payrollYear is a numeric identifier, never a measure)", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      dataSource: "PAYROLL",
      columns: ["payrollStatus"],
      kpis: [{ aggregation: "sum", valueField: "payrollYear" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects a non-count KPI with no valueField", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      kpis: [{ aggregation: "avg" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects a KPI spec that has a groupBy — that makes it a chart, not a KPI", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      kpis: [{ aggregation: "count", groupBy: { field: "department", bucket: "category", chartType: "bar" } }],
    })
    expect(result.success).toBe(false)
  })

  it("count is always accepted, with no valueField required", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      kpis: [{ aggregation: "count" }],
    })
    expect(result.success).toBe(true)
  })
})

describe("reportDefinitionInputSchema — chartConfig", () => {
  it("accepts a category groupBy (enum/curated string) with bar or pie", () => {
    for (const chartType of ["bar", "pie"] as const) {
      const result = reportDefinitionInputSchema.safeParse({
        ...validEmployeesReport,
        chartConfig: { aggregation: "count", groupBy: { field: "department", bucket: "category", chartType } },
      })
      expect(result.success).toBe(true)
    }
  })

  it("rejects category groupBy with chartType \"line\" (not a meaningful chart for categories)", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      chartConfig: { aggregation: "count", groupBy: { field: "department", bucket: "category", chartType: "line" } },
    })
    expect(result.success).toBe(false)
  })

  it("accepts a date groupBy (month/year) with bar or line, rejects pie", () => {
    const valid = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      chartConfig: { aggregation: "count", groupBy: { field: "hireDate", bucket: "month", chartType: "line" } },
    })
    expect(valid.success).toBe(true)

    const invalid = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      chartConfig: { aggregation: "count", groupBy: { field: "hireDate", bucket: "year", chartType: "pie" } },
    })
    expect(invalid.success).toBe(false)
  })

  it("accepts a number field with interval bucket and bar, rejects pie/line for interval", () => {
    const valid = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      chartConfig: { aggregation: "count", groupBy: { field: "age", bucket: "interval", bucketCount: 5, chartType: "bar" } },
    })
    expect(valid.success).toBe(true)

    const invalid = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      chartConfig: { aggregation: "count", groupBy: { field: "age", bucket: "interval", chartType: "pie" } },
    })
    expect(invalid.success).toBe(false)
  })

  it("rejects a bucket kind the field's own type does not support (category on a number field)", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      chartConfig: { aggregation: "count", groupBy: { field: "age", bucket: "category", chartType: "bar" } },
    })
    expect(result.success).toBe(false)
  })

  it("rejects a groupBy field that belongs to a different data source", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      chartConfig: { aggregation: "count", groupBy: { field: "leaveTypeName", bucket: "category", chartType: "bar" } },
    })
    expect(result.success).toBe(false)
  })

  it("rejects a chart spec with no groupBy at all", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      chartConfig: { aggregation: "count" },
    })
    expect(result.success).toBe(false)
  })

  it("rejects a sum chart value field PAYROLL has deliberately not made aggregatable", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      dataSource: "PAYROLL",
      columns: ["payrollStatus"],
      chartConfig: {
        aggregation: "sum",
        valueField: "payrollYear",
        groupBy: { field: "payrollEmployeeDepartment", bucket: "category", chartType: "bar" },
      },
    })
    expect(result.success).toBe(false)
  })

  it("accepts null (no chart configured)", () => {
    const result = reportDefinitionInputSchema.safeParse({ ...validEmployeesReport, chartConfig: null })
    expect(result.success).toBe(true)
  })

  it("accepts a percentageBase of \"all\" or \"group\" on groupBy", () => {
    for (const percentageBase of ["all", "group"] as const) {
      const result = reportDefinitionInputSchema.safeParse({
        ...validEmployeesReport,
        chartConfig: { aggregation: "count", groupBy: { field: "department", bucket: "category", chartType: "bar", percentageBase } },
      })
      expect(result.success).toBe(true)
    }
  })
})

// 2026-11-11 — "KPI/chart-only" reports: columns are no longer mandatory,
// only "produce at least one kind of output" is.
describe("reportDefinitionInputSchema — columns are optional when a KPI/chart exists", () => {
  it("accepts an empty columns array when a chart is configured", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      columns: [],
      chartConfig: { aggregation: "count", groupBy: { field: "department", bucket: "category", chartType: "bar" } },
    })
    expect(result.success).toBe(true)
  })

  it("accepts an empty columns array when a KPI exists", () => {
    const result = reportDefinitionInputSchema.safeParse({
      ...validEmployeesReport,
      columns: [],
      kpis: [{ aggregation: "avg", valueField: "age" }],
    })
    expect(result.success).toBe(true)
  })

  // 2026-11-11 (requirement 8, explicit user decision — reversing the
  // earlier "must produce at least one output" check): the implicit row
  // count is itself always a valid report — a user who only applies a
  // filter can save/export "just the filtered count".
  it("accepts a report with no columns, no kpis, and no chart — the implicit row count is enough", () => {
    const result = reportDefinitionInputSchema.safeParse({ ...validEmployeesReport, columns: [] })
    expect(result.success).toBe(true)
  })
})

// Phase C (2026-11-11) — standalone pivot validation. Not yet wired into
// reportDefinitionInputSchema/reportPreviewInputSchema (see pivotSpecSchema's
// own comment) — tested independently here for exactly that reason.
describe("pivotSpecSchema", () => {
  const validPivot = {
    aggregation: "count" as const,
    rowDimension: { field: "department", bucket: "category" as const },
    columnDimension: { field: "gender", bucket: "category" as const },
  }

  it("accepts a well-formed count pivot with no valueField", () => {
    expect(pivotSpecSchema.safeParse(validPivot).success).toBe(true)
  })

  it("accepts a well-formed sum/avg/min/max pivot with a valueField", () => {
    for (const aggregation of ["sum", "avg", "min", "max"] as const) {
      const result = pivotSpecSchema.safeParse({ ...validPivot, aggregation, valueField: "age" })
      expect(result.success).toBe(true)
    }
  })

  it("rejects a non-count aggregation with no valueField", () => {
    const result = pivotSpecSchema.safeParse({ ...validPivot, aggregation: "avg" })
    expect(result.success).toBe(false)
  })

  it("rejects row and column dimensions naming the same field", () => {
    const result = pivotSpecSchema.safeParse({
      ...validPivot,
      columnDimension: { field: "department", bucket: "category" as const },
    })
    expect(result.success).toBe(false)
  })

  it("accepts a valid percentageBase and chartType", () => {
    const result = pivotSpecSchema.safeParse({ ...validPivot, percentageBase: "row", chartType: "bar" })
    expect(result.success).toBe(true)
  })

  it("rejects an unknown bucket/percentageBase/chartType value", () => {
    expect(pivotSpecSchema.safeParse({ ...validPivot, rowDimension: { field: "department", bucket: "nonsense" } }).success).toBe(false)
    expect(pivotSpecSchema.safeParse({ ...validPivot, percentageBase: "nonsense" }).success).toBe(false)
    expect(pivotSpecSchema.safeParse({ ...validPivot, chartType: "nonsense" }).success).toBe(false)
  })
})

describe("isPivotSpecValidForDataSource", () => {
  it("accepts a pivot whose both dimensions and valueField belong to the declared data source", () => {
    const spec = {
      aggregation: "avg" as const,
      valueField: "age",
      rowDimension: { field: "department", bucket: "category" as const },
      columnDimension: { field: "gender", bucket: "category" as const },
    }
    expect(isPivotSpecValidForDataSource("EMPLOYEES", spec)).toBe(true)
  })

  it("rejects a dimension field from a different data source", () => {
    const spec = {
      aggregation: "count" as const,
      rowDimension: { field: "leaveTypeName", bucket: "category" as const }, // LEAVE_REQUESTS
      columnDimension: { field: "gender", bucket: "category" as const },
    }
    expect(isPivotSpecValidForDataSource("EMPLOYEES", spec)).toBe(false)
  })

  it("rejects a valueField whose own registry entry does not allow the requested aggregation", () => {
    const spec = {
      aggregation: "sum" as const,
      valueField: "age", // age's aggregations are avg/min/max — never sum
      rowDimension: { field: "department", bucket: "category" as const },
      columnDimension: { field: "gender", bucket: "category" as const },
    }
    expect(isPivotSpecValidForDataSource("EMPLOYEES", spec)).toBe(false)
  })

  it("rejects a dimension bucket the field's own type does not support", () => {
    const spec = {
      aggregation: "count" as const,
      rowDimension: { field: "department", bucket: "interval" as const }, // department is categorical, not numeric
      columnDimension: { field: "gender", bucket: "category" as const },
    }
    expect(isPivotSpecValidForDataSource("EMPLOYEES", spec)).toBe(false)
  })

  it("rejects every PAYROLL pivot value field — no financial/aggregatable field exists there", () => {
    const spec = {
      aggregation: "sum" as const,
      valueField: "payrollYear",
      rowDimension: { field: "payrollEmployeeDepartment", bucket: "category" as const },
      columnDimension: { field: "payrollStatus", bucket: "category" as const },
    }
    expect(isPivotSpecValidForDataSource("PAYROLL", spec)).toBe(false)
  })

  it("accepts a PAYROLL pivot that only counts (no valueField needed)", () => {
    const spec = {
      aggregation: "count" as const,
      rowDimension: { field: "payrollEmployeeDepartment", bucket: "category" as const },
      columnDimension: { field: "payrollStatus", bucket: "category" as const },
    }
    expect(isPivotSpecValidForDataSource("PAYROLL", spec)).toBe(true)
  })
})
