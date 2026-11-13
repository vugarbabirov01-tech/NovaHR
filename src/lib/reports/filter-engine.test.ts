import { describe, expect, it } from "vitest"

import { applyFilters, sortRows } from "@/lib/reports/filter-engine"
import type { ReportRow } from "@/types/reports"

const rows: ReportRow[] = [
  { firstName: "Ali", age: 30, hireDate: "2020-01-15", employmentStatus: "active" },
  { firstName: "Vali", age: 45, hireDate: "2015-06-01", employmentStatus: "probation" },
  { firstName: "Gulnar", age: null, hireDate: "", employmentStatus: "terminated" },
]

describe("applyFilters", () => {
  it("ignores an incomplete filter (empty value) instead of matching nothing", () => {
    expect(applyFilters(rows, [{ field: "firstName", operator: "equals", value: "" }])).toHaveLength(rows.length)
    expect(applyFilters(rows, [{ field: "age", operator: "greaterThan", value: null }])).toHaveLength(rows.length)
    expect(applyFilters(rows, [{ field: "age", operator: "between", value: 30, valueTo: null }])).toHaveLength(rows.length)
  })

  it("string equals is case-insensitive", () => {
    expect(applyFilters(rows, [{ field: "firstName", operator: "equals", value: "ali" }])).toHaveLength(1)
  })

  it("string contains matches a substring", () => {
    expect(applyFilters(rows, [{ field: "firstName", operator: "contains", value: "al" }]).map((r) => r.firstName)).toEqual([
      "Ali",
      "Vali",
    ])
  })

  it("string startsWith only matches the prefix", () => {
    expect(applyFilters(rows, [{ field: "firstName", operator: "startsWith", value: "Va" }])).toHaveLength(1)
  })

  it("string notEquals excludes the exact match", () => {
    expect(applyFilters(rows, [{ field: "employmentStatus", operator: "notEquals", value: "active" }])).toHaveLength(2)
  })

  it("number greaterThan / lessThan compare numerically, not lexically", () => {
    expect(applyFilters(rows, [{ field: "age", operator: "greaterThan", value: 40 }]).map((r) => r.firstName)).toEqual([
      "Vali",
    ])
    expect(applyFilters(rows, [{ field: "age", operator: "lessThan", value: 40 }]).map((r) => r.firstName)).toEqual(["Ali"])
  })

  it("number between is inclusive on both ends", () => {
    expect(applyFilters(rows, [{ field: "age", operator: "between", value: 30, valueTo: 45 }])).toHaveLength(2)
  })

  it("date greaterThan compares as real dates", () => {
    expect(
      applyFilters(rows, [{ field: "hireDate", operator: "greaterThan", value: "2018-01-01" }]).map((r) => r.firstName)
    ).toEqual(["Ali"])
  })

  it("isEmpty matches null and empty-string values for any field type", () => {
    const result = applyFilters(rows, [{ field: "age", operator: "isEmpty" }])
    expect(result.map((r) => r.firstName)).toEqual(["Gulnar"])
  })

  it("isNotEmpty excludes null and empty-string values", () => {
    expect(applyFilters(rows, [{ field: "hireDate", operator: "isNotEmpty" }])).toHaveLength(2)
  })

  it("combines multiple filters with AND", () => {
    const result = applyFilters(rows, [
      { field: "age", operator: "greaterThan", value: 20 },
      { field: "employmentStatus", operator: "equals", value: "probation" },
    ])
    expect(result.map((r) => r.firstName)).toEqual(["Vali"])
  })

  it("an unknown field is never a reason to hide a row", () => {
    expect(applyFilters(rows, [{ field: "doesNotExist", operator: "equals", value: "x" }])).toHaveLength(3)
  })
})

describe("sortRows", () => {
  it("sorts strings ascending and descending", () => {
    expect(sortRows(rows, "firstName", "asc").map((r) => r.firstName)).toEqual(["Ali", "Gulnar", "Vali"])
    expect(sortRows(rows, "firstName", "desc").map((r) => r.firstName)).toEqual(["Vali", "Gulnar", "Ali"])
  })

  it("sorts numbers numerically, with null treated as lowest", () => {
    expect(sortRows(rows, "age", "asc").map((r) => r.firstName)).toEqual(["Gulnar", "Ali", "Vali"])
  })

  it("returns the input unchanged when sortBy is null", () => {
    expect(sortRows(rows, null, "asc")).toBe(rows)
  })
})
