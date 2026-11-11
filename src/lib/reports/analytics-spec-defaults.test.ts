import { describe, expect, it } from "vitest"

import { buildChartSpecForField } from "@/lib/reports/analytics-spec-defaults"

describe("buildChartSpecForField", () => {
  it("defaults a category field (no previous spec) to count + its first allowed bucket/chartType", () => {
    const spec = buildChartSpecForField("department")
    expect(spec.aggregation).toBe("count")
    expect(spec.valueField).toBeUndefined()
    expect(spec.groupBy?.field).toBe("department")
    expect(spec.groupBy?.bucket).toBe("category")
    expect(["bar", "pie"]).toContain(spec.groupBy?.chartType)
  })

  it("defaults an interval-eligible numeric field to a bucketCount of 8", () => {
    const spec = buildChartSpecForField("age")
    expect(spec.groupBy?.bucket).toBe("interval")
    expect(spec.groupBy?.bucketCount).toBe(8)
  })

  it("defaults a date field to month/year with bar or line", () => {
    const spec = buildChartSpecForField("hireDate")
    expect(["month", "year"]).toContain(spec.groupBy?.bucket)
    expect(["bar", "line"]).toContain(spec.groupBy?.chartType)
  })

  it("keeps a previous spec's aggregation/valueField/bucketCount when switching to a new field of a compatible bucket kind", () => {
    const previous = buildChartSpecForField("age", null) // interval, bucketCount 8
    const updated = buildChartSpecForField("tenureYearsDecimal", previous) // also "number" -> interval
    expect(updated.groupBy?.bucket).toBe("interval")
    expect(updated.groupBy?.bucketCount).toBe(8)
  })

  it("resets bucket/chartType to the new field's own default when the previous bucket is not valid for it", () => {
    const previous = buildChartSpecForField("age") // interval
    const updated = buildChartSpecForField("department", previous) // category-only field
    expect(updated.groupBy?.bucket).toBe("category")
  })

  it("throws for an unknown field key rather than silently building a broken spec", () => {
    expect(() => buildChartSpecForField("not-a-real-field")).toThrow()
  })
})
