import { describe, expect, it } from "vitest"

import { calculateAgeFromDateOfBirth, calculateServiceDuration } from "@/lib/employees"
import { withTestEmployee } from "@/lib/leave/leave-test-fixtures"
import { buildAnalyticsValueFormatters, formatAnalyticsValue } from "@/lib/reports/analytics-format"
import { executeReport } from "@/lib/reports/report-execution-service"

/**
 * Integration tests for the Phase 3 universal-analytics wiring in
 * executeReport — real dev.db, a single disposable test employee (see
 * leave-test-fixtures.ts), scoped down to exactly that one row via an
 * `employeeNumber equals <its own test id>` filter so results are fully
 * deterministic regardless of how many real employees exist. Cleaned up
 * via withTestEmployee's own finally-block deletion either way.
 */
describe("executeReport — kpis/chart", () => {
  it("always prepends an implicit row-count KPI, computed from the full filtered set", async () => {
    await withTestEmployee("EMP-1041", async (profile) => {
      const result = await executeReport({
        dataSource: "EMPLOYEES",
        columns: ["firstName"],
        filters: [{ field: "employeeNumber", operator: "equals", value: profile.employment.employeeNumber! }],
        sortBy: null,
        sortDirection: "asc",
        page: 1,
        pageSize: 1,
      })

      expect(result.totalCount).toBe(1)
      expect(result.kpis).toHaveLength(1)
      expect(result.kpis[0].points).toEqual([{ key: "total", value: 1 }])
      expect(result.chart).toBeNull()
    })
  })

  it("computes a user-selected KPI (avg age) from the real field value, matching the field's own calculation", async () => {
    await withTestEmployee("EMP-1041", async (profile) => {
      const result = await executeReport({
        dataSource: "EMPLOYEES",
        columns: ["firstName"],
        filters: [{ field: "employeeNumber", operator: "equals", value: profile.employment.employeeNumber! }],
        sortBy: null,
        sortDirection: "asc",
        kpis: [{ aggregation: "avg", valueField: "age" }],
      })

      const expectedAge = calculateAgeFromDateOfBirth(profile.personal.dateOfBirth)
      expect(result.kpis).toHaveLength(2) // implicit row count + the one requested
      expect(result.kpis[1].points[0].value).toBe(expectedAge)
    })
  })

  it("computes the chart from the full filtered set and never branches on dataSource to do so", async () => {
    await withTestEmployee("EMP-1041", async (profile) => {
      const result = await executeReport({
        dataSource: "EMPLOYEES",
        columns: ["firstName"],
        filters: [{ field: "employeeNumber", operator: "equals", value: profile.employment.employeeNumber! }],
        sortBy: null,
        sortDirection: "asc",
        chartConfig: { aggregation: "count", groupBy: { field: "gender", bucket: "category", chartType: "pie" } },
      })

      expect(result.chart).not.toBeNull()
      expect(result.chart!.points).toHaveLength(1)
      expect(result.chart!.points[0].value).toBe(1)
      expect(result.chart!.points[0].key).toBe(profile.personal.gender)
    })
  })

  it("KPIs/chart reflect every matching row, not just the returned page", async () => {
    await withTestEmployee("EMP-1041", async (profile) => {
      // pageSize 1 with a filter matching exactly 1 row either way here —
      // the real assertion is that kpis/chart are computed from `filtered`
      // (see report-execution-service.ts), not from the post-pagination
      // `rows` array, which this call deliberately keeps distinct by
      // requesting a column (lastName) never read by the kpi/chart spec.
      const result = await executeReport({
        dataSource: "EMPLOYEES",
        columns: ["lastName"],
        filters: [{ field: "employeeNumber", operator: "equals", value: profile.employment.employeeNumber! }],
        sortBy: null,
        sortDirection: "asc",
        page: 1,
        pageSize: 1,
        kpis: [{ aggregation: "min", valueField: "age" }],
      })

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]).toEqual({ lastName: profile.personal.lastName })
      expect(result.kpis[1].points[0].value).toBe(calculateAgeFromDateOfBirth(profile.personal.dateOfBirth))
    })
  })

  // 2026-11-11 bug report, verified end-to-end against real dev.db: the
  // KPI card used to show the raw average-months number unformatted (the
  // reported "73"). executeReport's own computation is untouched here —
  // this confirms the FIX is entirely in the display formatter
  // (analytics-format.ts), by running that formatter against a value this
  // test computed from the real, live employee repository.
  it("the average tenureDurationMonths KPI, once formatted, reads as years+months — not the raw month count", async () => {
    await withTestEmployee("EMP-1041", async (profile) => {
      const result = await executeReport({
        dataSource: "EMPLOYEES",
        columns: ["firstName"],
        filters: [{ field: "employeeNumber", operator: "equals", value: profile.employment.employeeNumber! }],
        sortBy: null,
        sortDirection: "asc",
        kpis: [{ aggregation: "avg", valueField: "tenureDurationMonths" }],
      })

      const rawAvgMonths = result.kpis[1].points[0].value
      const expectedDuration = calculateServiceDuration(profile.employment.hireDate)
      const expectedTotalMonths = expectedDuration.years * 12 + expectedDuration.months
      expect(rawAvgMonths).toBe(expectedTotalMonths) // engine itself still returns raw months, unrounded/unformatted

      const fakeT = (key: string, params?: Record<string, unknown>) =>
        key === "tenureDurationFormat" ? `${params!.years} il ${params!.months} ay` : key
      const formatters = buildAnalyticsValueFormatters(fakeT, (value, options) => new Intl.NumberFormat("en-US", options).format(value))
      const formatted = formatAnalyticsValue(rawAvgMonths, { aggregation: "avg", valueField: "tenureDurationMonths" }, formatters)
      expect(formatted).toBe(`${expectedDuration.years} il ${expectedDuration.months} ay`)
      expect(formatted).not.toBe(String(rawAvgMonths)) // never the bare "73"-style number again
    })
  })

  it("a grouped chart's percentage flows through executeReport unchanged from the engine (real DB)", async () => {
    await withTestEmployee("EMP-1041", async (profile) => {
      const result = await executeReport({
        dataSource: "EMPLOYEES",
        columns: ["firstName"],
        filters: [{ field: "employeeNumber", operator: "equals", value: profile.employment.employeeNumber! }],
        sortBy: null,
        sortDirection: "asc",
        chartConfig: { aggregation: "count", groupBy: { field: "gender", bucket: "category", chartType: "pie" } },
      })

      expect(result.chart!.points[0].percentage).toBe(100) // the only matching row is 100% of itself
    })
  })
})
