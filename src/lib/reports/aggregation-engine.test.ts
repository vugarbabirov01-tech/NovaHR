import { describe, expect, it } from "vitest"

import { computeAnalytics } from "@/lib/reports/aggregation-engine"
import type { ReportRow } from "@/types/reports"

describe("aggregation-engine — computeAnalytics", () => {
  describe("scalar (no groupBy) — KPI path", () => {
    it("counts rows regardless of field values", () => {
      const rows: ReportRow[] = [{ age: 20 }, { age: null }, { age: 30 }]
      const result = computeAnalytics(rows, { aggregation: "count" })
      expect(result.points).toEqual([{ key: "total", value: 3 }])
      expect(result.cappedOther).toBe(false)
    })

    it("sums/averages/min/max a numeric field, ignoring null/empty values", () => {
      const rows: ReportRow[] = [{ age: 20 }, { age: null }, { age: 30 }, { age: "" }, { age: 40 }]
      expect(computeAnalytics(rows, { aggregation: "sum", valueField: "age" }).points[0].value).toBe(90)
      expect(computeAnalytics(rows, { aggregation: "avg", valueField: "age" }).points[0].value).toBe(30)
      expect(computeAnalytics(rows, { aggregation: "min", valueField: "age" }).points[0].value).toBe(20)
      expect(computeAnalytics(rows, { aggregation: "max", valueField: "age" }).points[0].value).toBe(40)
    })

    it("returns 0 for sum/avg/min/max when every value is missing, never NaN/null", () => {
      const rows: ReportRow[] = [{ age: null }, { age: "" }]
      for (const aggregation of ["sum", "avg", "min", "max"] as const) {
        const result = computeAnalytics(rows, { aggregation, valueField: "age" })
        expect(result.points[0].value).toBe(0)
      }
    })

    it("handles an empty row set", () => {
      const result = computeAnalytics([], { aggregation: "count" })
      expect(result.points).toEqual([{ key: "total", value: 0 }])
    })
  })

  describe("groupBy bucket: category", () => {
    it("groups by distinct raw string value and counts each group", () => {
      const rows: ReportRow[] = [
        { department: "IT" },
        { department: "IT" },
        { department: "HR" },
        { department: null },
      ]
      const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "department", bucket: "category" } })
      expect(result.cappedOther).toBe(false)
      const byKey = new Map(result.points.map((p) => [p.key, p.value]))
      expect(byKey.get("IT")).toBe(2)
      expect(byKey.get("HR")).toBe(1)
      // the null-department row is excluded entirely, not folded into a
      // phantom "null" category
      expect(result.points.length).toBe(2)
    })

    it("applies sum/avg per category group, not just count", () => {
      const rows: ReportRow[] = [
        { department: "IT", leaveRequestedUnits: 5 },
        { department: "IT", leaveRequestedUnits: 3 },
        { department: "HR", leaveRequestedUnits: 10 },
      ]
      const result = computeAnalytics(rows, {
        aggregation: "sum",
        valueField: "leaveRequestedUnits",
        groupBy: { field: "department", bucket: "category" },
      })
      const byKey = new Map(result.points.map((p) => [p.key, p.value]))
      expect(byKey.get("IT")).toBe(8)
      expect(byKey.get("HR")).toBe(10)
    })

    it("caps at 15 categories and folds the smallest into __other__", () => {
      const rows: ReportRow[] = []
      for (let i = 0; i < 20; i++) {
        // group 0 is the largest so it's never folded away, confirming the
        // cap keeps the biggest groups and folds the smallest ones
        const count = i === 0 ? 50 : 1
        for (let j = 0; j < count; j++) rows.push({ department: `D${i}` })
      }
      const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "department", bucket: "category" } })
      expect(result.cappedOther).toBe(true)
      expect(result.points.length).toBe(15) // 14 real groups + 1 "Other"
      const byKey = new Map(result.points.map((p) => [p.key, p.value]))
      expect(byKey.get("D0")).toBe(50)
      expect(byKey.has("__other__")).toBe(true)
      const totalAcrossPoints = result.points.reduce((sum, p) => sum + p.value, 0)
      expect(totalAcrossPoints).toBe(rows.length) // no row silently dropped
    })
  })

  describe("groupBy bucket: month / year", () => {
    it("truncates dates to year", () => {
      const rows: ReportRow[] = [{ hireDate: "2024-03-10" }, { hireDate: "2024-11-02" }, { hireDate: "2023-01-01" }]
      const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "hireDate", bucket: "year" } })
      const byKey = new Map(result.points.map((p) => [p.key, p.value]))
      expect(byKey.get("2024")).toBe(2)
      expect(byKey.get("2023")).toBe(1)
      expect(result.points.map((p) => p.key)).toEqual(["2023", "2024"]) // chronological, not count-sorted
    })

    it("truncates dates to month", () => {
      const rows: ReportRow[] = [{ hireDate: "2024-03-10" }, { hireDate: "2024-03-22" }, { hireDate: "2024-01-05" }]
      const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "hireDate", bucket: "month" } })
      const byKey = new Map(result.points.map((p) => [p.key, p.value]))
      expect(byKey.get("2024-03")).toBe(2)
      expect(byKey.get("2024-01")).toBe(1)
    })

    it("excludes rows with an unparseable or missing date", () => {
      const rows: ReportRow[] = [{ hireDate: "2024-03-10" }, { hireDate: "" }, { hireDate: null }]
      const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "hireDate", bucket: "year" } })
      expect(result.points).toEqual([{ key: "2024", value: 1, percentage: 100 }])
    })
  })

  describe("groupBy bucket: interval", () => {
    it("bins a numeric field into equal-width ranges over the filtered set's own min/max", () => {
      const rows: ReportRow[] = Array.from({ length: 10 }, (_, i) => ({ age: 20 + i * 2 })) // 20,22,...,38
      const result = computeAnalytics(rows, {
        aggregation: "count",
        groupBy: { field: "age", bucket: "interval", bucketCount: 2 },
      })
      expect(result.points.length).toBe(2)
      const total = result.points.reduce((sum, p) => sum + p.value, 0)
      expect(total).toBe(10) // every row lands in exactly one bucket
    })

    it("falls back to a single bucket when every value is identical", () => {
      const rows: ReportRow[] = [{ age: 30 }, { age: 30 }, { age: 30 }]
      const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "age", bucket: "interval" } })
      expect(result.points.length).toBe(1)
      expect(result.points[0].value).toBe(3)
    })

    it("clamps an out-of-range bucketCount into [2, 20]", () => {
      const rows: ReportRow[] = Array.from({ length: 50 }, (_, i) => ({ age: i }))
      const tooMany = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "age", bucket: "interval", bucketCount: 1000 } })
      expect(tooMany.points.length).toBeLessThanOrEqual(20)
      const tooFew = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "age", bucket: "interval", bucketCount: 0 } })
      expect(tooFew.points.length).toBeGreaterThanOrEqual(1)
      expect(tooFew.points.length).toBeLessThanOrEqual(2)
    })

    it("returns no points when no row has a parseable numeric value", () => {
      const rows: ReportRow[] = [{ age: null }, { age: "" }]
      const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "age", bucket: "interval" } })
      expect(result.points).toEqual([])
    })

    // Regression (2026-11-11): a fractional bucket width used to let two
    // adjacent buckets round to the identical label — reproduced here with
    // the exact kind of narrow, filtered-down integer range (e.g. one
    // department's age spread) that triggered it in the real app.
    it("never produces two points with the same label, for a narrow integer range", () => {
      const rows: ReportRow[] = [25, 26, 27, 28, 29, 30].map((age) => ({ age }))
      const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "age", bucket: "interval", bucketCount: 8 } })
      const labels = result.points.map((p) => p.key)
      expect(new Set(labels).size).toBe(labels.length)
      // every row still accounted for exactly once
      expect(result.points.reduce((sum, p) => sum + p.value, 0)).toBe(6)
    })

    it("every integer value is covered by exactly one bucket's inclusive range, with no gap or overlap", () => {
      const rows: ReportRow[] = Array.from({ length: 55 }, (_, i) => ({ age: 18 + i })) // 18..72, like real employee ages
      const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "age", bucket: "interval", bucketCount: 8 } })
      const labels = result.points.map((p) => p.key)
      expect(new Set(labels).size).toBe(labels.length) // no duplicate label
      expect(result.points.reduce((sum, p) => sum + p.value, 0)).toBe(55) // every row counted exactly once

      // Parse each "lower–upper" (or single-value) label and confirm the
      // ranges themselves are contiguous and non-overlapping.
      const ranges = labels.map((label) => {
        const [lo, hi] = label.includes("–") ? label.split("–").map(Number) : [Number(label), Number(label)]
        return { lo, hi }
      })
      for (let i = 1; i < ranges.length; i++) {
        expect(ranges[i].lo).toBe(ranges[i - 1].hi + 1)
      }
    })

    it("clamps the effective bucket count to the number of distinct integer values, never creating empty/duplicate buckets", () => {
      const rows: ReportRow[] = [30, 30, 31, 31, 32].map((age) => ({ age })) // only 3 distinct values
      const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "age", bucket: "interval", bucketCount: 20 } })
      expect(result.points).toHaveLength(3)
      expect(result.points.map((p) => p.key)).toEqual(["30", "31", "32"])
    })

    it("uses enough decimal precision that a narrow decimal range never produces duplicate labels either", () => {
      const rows: ReportRow[] = Array.from({ length: 8 }, (_, i) => ({ tenureYearsDecimal: 20 + i * 0.125 })) // 20.0..20.875
      const result = computeAnalytics(rows, {
        aggregation: "count",
        groupBy: { field: "tenureYearsDecimal", bucket: "interval", bucketCount: 8 },
      })
      const labels = result.points.map((p) => p.key)
      expect(new Set(labels).size).toBe(labels.length)
    })
  })

  describe("percentage (2026-11-11)", () => {
    it("computes each grouped point's share of the sum of every point's own value", () => {
      const rows: ReportRow[] = [
        { department: "IT" },
        { department: "IT" },
        { department: "IT" },
        { department: "HR" },
      ]
      const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "department", bucket: "category" } })
      const byKey = new Map(result.points.map((p) => [p.key, p.percentage]))
      expect(byKey.get("IT")).toBe(75)
      expect(byKey.get("HR")).toBe(25)
    })

    it("reports 0, never NaN/Infinity, when every point's value is 0", () => {
      const rows: ReportRow[] = [
        { department: "IT", leaveRequestedUnits: null },
        { department: "HR", leaveRequestedUnits: null },
      ]
      const result = computeAnalytics(rows, {
        aggregation: "sum",
        valueField: "leaveRequestedUnits",
        groupBy: { field: "department", bucket: "category" },
      })
      for (const point of result.points) {
        expect(point.percentage).toBe(0)
        expect(Number.isFinite(point.percentage)).toBe(true)
      }
    })

    it("every point's percentage sums to 100 (within rounding)", () => {
      const rows: ReportRow[] = [{ department: "A" }, { department: "B" }, { department: "C" }]
      const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "department", bucket: "category" } })
      const total = result.points.reduce((sum, p) => sum + (p.percentage ?? 0), 0)
      expect(Math.round(total)).toBe(100)
    })

    it("is absent on a scalar (KPI) result — percentage of what has no meaning for a single number", () => {
      const result = computeAnalytics([{ age: 30 }], { aggregation: "count" })
      expect(result.points[0].percentage).toBeUndefined()
    })

    it("also applies to interval buckets", () => {
      const rows: ReportRow[] = [{ age: 20 }, { age: 20 }, { age: 40 }]
      const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "age", bucket: "interval", bucketCount: 2 } })
      const total = result.points.reduce((sum, p) => sum + (p.percentage ?? 0), 0)
      expect(Math.round(total)).toBe(100)
    })
  })

  it("never branches on a data-source concept — the same function serves every field, proven by passing arbitrary row shapes", () => {
    // This test has no assertion about data sources on purpose: it exists
    // to document that computeAnalytics takes only (rows, spec), matching
    // the 2026-11-11 universal-architecture requirement that a new data
    // source needs no new code in this file.
    const rows: ReportRow[] = [{ anyField: "x" }, { anyField: "y" }, { anyField: "x" }]
    const result = computeAnalytics(rows, { aggregation: "count", groupBy: { field: "anyField", bucket: "category" } })
    expect(result.points.length).toBe(2)
  })
})
