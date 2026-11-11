import { describe, expect, it } from "vitest"

import { computePivotAnalytics, findPivotCell } from "@/lib/reports/aggregation-engine"
import type { PivotSpec, ReportRow } from "@/types/reports"

/**
 * Phase C (2026-11-11) — the 2D pivot engine. Every test is grounded in
 * the explicit written requirements: mathematically correct row/column/
 * grand totals (not a naive sum of cell values), empty-vs-zero cell
 * distinction, percentage only for count/sum, and independent per-axis
 * category capping.
 */
describe("computePivotAnalytics", () => {
  const rows: ReportRow[] = [
    { department: "IT", gender: "male", age: 30 },
    { department: "IT", gender: "male", age: 40 },
    { department: "IT", gender: "female", age: 50 },
    { department: "HR", gender: "female", age: 20 },
    { department: "HR", gender: "female", age: 60 },
  ]

  const countSpec: PivotSpec = {
    aggregation: "count",
    rowDimension: { field: "department", bucket: "category" },
    columnDimension: { field: "gender", bucket: "category" },
  }

  it("builds a sparse cross-tab with the right row/column keys", () => {
    const result = computePivotAnalytics(rows, countSpec)
    expect(result.rowKeys.sort()).toEqual(["HR", "IT"])
    expect(result.columnKeys.sort()).toEqual(["female", "male"])
  })

  it("counts each cell correctly", () => {
    const result = computePivotAnalytics(rows, countSpec)
    expect(findPivotCell(result, "IT", "male")?.value).toBe(2)
    expect(findPivotCell(result, "IT", "female")?.value).toBe(1)
    expect(findPivotCell(result, "HR", "female")?.value).toBe(2)
  })

  it("distinguishes a genuinely empty cell (no matching rows) from a real 0", () => {
    const result = computePivotAnalytics(rows, countSpec)
    // HR has no male employees in this dataset at all — that cell must be
    // ABSENT, not present with value 0.
    expect(findPivotCell(result, "HR", "male")).toBeUndefined()
  })

  it("a sum/count cell that aggregates to a real 0 is still present (not confused with an empty cell)", () => {
    const zeroRows: ReportRow[] = [
      { department: "IT", gender: "male", bonusDays: 0 },
      { department: "IT", gender: "male", bonusDays: 0 },
    ]
    const spec: PivotSpec = {
      aggregation: "sum",
      valueField: "bonusDays",
      rowDimension: { field: "department", bucket: "category" },
      columnDimension: { field: "gender", bucket: "category" },
    }
    const result = computePivotAnalytics(zeroRows, spec)
    const cell = findPivotCell(result, "IT", "male")
    expect(cell).not.toBeUndefined()
    expect(cell?.value).toBe(0)
  })

  it("excludes a row entirely when either dimension's value is missing — never a phantom null bucket", () => {
    const withMissing: ReportRow[] = [...rows, { department: null, gender: "male", age: 25 }, { department: "IT", gender: null, age: 25 }]
    const result = computePivotAnalytics(withMissing, countSpec)
    const total = result.cells.reduce((sum, cell) => sum + cell.value, 0)
    expect(total).toBe(5) // only the original 5 fully-specified rows
  })

  describe("mathematically correct totals (requirement 2 — never a naive sum of cell values)", () => {
    const avgSpec: PivotSpec = {
      aggregation: "avg",
      valueField: "age",
      rowDimension: { field: "department", bucket: "category" },
      columnDimension: { field: "gender", bucket: "category" },
    }

    it("a row total is the average of EVERY row with that row key across all columns, not an average of the row's own per-column cell averages", () => {
      // IT: male ages [30,40] -> cell avg 35; female ages [50] -> cell avg
      // 50. A naive "average the cells" would give (35+50)/2 = 42.5. The
      // mathematically correct row average over all 3 IT rows is
      // (30+40+50)/3 = 40.
      const result = computePivotAnalytics(rows, avgSpec)
      expect(result.rowTotals.IT).toBe(40)
      expect(result.rowTotals.IT).not.toBe(42.5)
    })

    it("a column total is the average of EVERY row with that column key across all rows", () => {
      // female ages across both departments: [50, 20, 60] -> avg 130/3 = 43.33...
      const result = computePivotAnalytics(rows, avgSpec)
      expect(result.columnTotals.female).toBeCloseTo((50 + 20 + 60) / 3, 5)
    })

    it("the grand total is the average of every included row, not an average of row/column totals", () => {
      const result = computePivotAnalytics(rows, avgSpec)
      expect(result.grandTotal).toBeCloseTo((30 + 40 + 50 + 20 + 60) / 5, 5)
    })

    it("sum totals are correct per row/column/grand (sum composes correctly either way, confirmed anyway)", () => {
      const sumSpec: PivotSpec = { ...avgSpec, aggregation: "sum" }
      const result = computePivotAnalytics(rows, sumSpec)
      expect(result.rowTotals.IT).toBe(30 + 40 + 50)
      expect(result.rowTotals.HR).toBe(20 + 60)
      expect(result.columnTotals.female).toBe(50 + 20 + 60)
      expect(result.grandTotal).toBe(30 + 40 + 50 + 20 + 60)
    })

    it("min/max totals reflect the real extremes across the full row/column group", () => {
      const minSpec: PivotSpec = { ...avgSpec, aggregation: "min" }
      const maxSpec: PivotSpec = { ...avgSpec, aggregation: "max" }
      expect(computePivotAnalytics(rows, minSpec).rowTotals.IT).toBe(30)
      expect(computePivotAnalytics(rows, maxSpec).rowTotals.IT).toBe(50)
      expect(computePivotAnalytics(rows, minSpec).columnTotals.female).toBe(20)
      expect(computePivotAnalytics(rows, maxSpec).columnTotals.female).toBe(60)
    })
  })

  describe("percentage (requirement 3 — only count/sum, never avg/min/max)", () => {
    it("computes percentage of the grand total by default (\"all\")", () => {
      const result = computePivotAnalytics(rows, countSpec) // 5 rows total
      const cell = findPivotCell(result, "IT", "male")!
      expect(cell.percentage).toBe(40) // 2/5 = 40%
    })

    it("computes percentage of the row total when percentageBase is \"row\"", () => {
      const result = computePivotAnalytics(rows, { ...countSpec, percentageBase: "row" })
      const cell = findPivotCell(result, "IT", "male")! // IT row total = 3
      expect(cell.percentage).toBeCloseTo((2 / 3) * 100, 1) // engine rounds to 2 decimals
    })

    it("computes percentage of the column total when percentageBase is \"column\"", () => {
      const result = computePivotAnalytics(rows, { ...countSpec, percentageBase: "column" })
      const cell = findPivotCell(result, "HR", "female")! // female column total = 3
      expect(cell.percentage).toBeCloseTo((2 / 3) * 100, 1) // engine rounds to 2 decimals
    })

    it("sum is percentage-eligible too", () => {
      const sumSpec: PivotSpec = {
        aggregation: "sum",
        valueField: "age",
        rowDimension: { field: "department", bucket: "category" },
        columnDimension: { field: "gender", bucket: "category" },
      }
      const result = computePivotAnalytics(rows, sumSpec)
      expect(findPivotCell(result, "IT", "male")!.percentage).toBeDefined()
    })

    it("never produces a percentage for avg/min/max — no sound meaning for those", () => {
      for (const aggregation of ["avg", "min", "max"] as const) {
        const spec: PivotSpec = {
          aggregation,
          valueField: "age",
          rowDimension: { field: "department", bucket: "category" },
          columnDimension: { field: "gender", bucket: "category" },
        }
        const result = computePivotAnalytics(rows, spec)
        for (const cell of result.cells) expect(cell.percentage).toBeUndefined()
      }
    })

    it("reports 0, never NaN/Infinity, when the relevant total is 0", () => {
      const zeroRows: ReportRow[] = [{ department: "IT", gender: "male", bonusDays: 0 }]
      const spec: PivotSpec = {
        aggregation: "sum",
        valueField: "bonusDays",
        rowDimension: { field: "department", bucket: "category" },
        columnDimension: { field: "gender", bucket: "category" },
      }
      const result = computePivotAnalytics(zeroRows, spec)
      const cell = findPivotCell(result, "IT", "male")!
      expect(cell.percentage).toBe(0)
      expect(Number.isFinite(cell.percentage)).toBe(true)
    })
  })

  describe("independent per-axis category capping", () => {
    it("caps the row axis without affecting the column axis, and vice versa", () => {
      const manyDepartments: ReportRow[] = []
      for (let i = 0; i < 20; i++) {
        manyDepartments.push({ department: `D${i}`, gender: i % 2 === 0 ? "male" : "female" })
      }
      const result = computePivotAnalytics(manyDepartments, countSpec)
      expect(result.cappedOtherRow).toBe(true)
      expect(result.cappedOtherColumn).toBe(false) // only 2 distinct genders, well under the cap
      expect(result.rowKeys.length).toBe(15) // 14 real + "__other__"
      expect(result.rowKeys[result.rowKeys.length - 1]).toBe("__other__")
      expect(result.columnKeys.sort()).toEqual(["female", "male"])
    })

    it("no row is lost across the cap — every cell's values still sum to the full row count", () => {
      const manyDepartments: ReportRow[] = []
      for (let i = 0; i < 20; i++) manyDepartments.push({ department: `D${i}`, gender: "male" })
      const result = computePivotAnalytics(manyDepartments, countSpec)
      const total = result.cells.reduce((sum, cell) => sum + cell.value, 0)
      expect(total).toBe(20)
    })
  })

  describe("shares the same bucket mechanism as 1D (requirement 1)", () => {
    it("an interval row dimension never produces duplicate/overlapping labels (same fix as the 1D histogram bug)", () => {
      const narrowAgeRows: ReportRow[] = [25, 26, 27, 28, 29, 30].map((age) => ({ age, gender: age % 2 === 0 ? "male" : "female" }))
      const spec: PivotSpec = {
        aggregation: "count",
        rowDimension: { field: "age", bucket: "interval", bucketCount: 8 },
        columnDimension: { field: "gender", bucket: "category" },
      }
      const result = computePivotAnalytics(narrowAgeRows, spec)
      expect(new Set(result.rowKeys).size).toBe(result.rowKeys.length)
    })

    it("a month/year dimension orders chronologically, same as the 1D chart", () => {
      const dated: ReportRow[] = [
        { hireDate: "2024-03-10", gender: "male" },
        { hireDate: "2023-01-01", gender: "female" },
      ]
      const spec: PivotSpec = {
        aggregation: "count",
        rowDimension: { field: "hireDate", bucket: "year" },
        columnDimension: { field: "gender", bucket: "category" },
      }
      const result = computePivotAnalytics(dated, spec)
      expect(result.rowKeys).toEqual(["2023", "2024"])
    })
  })

  it("never branches on a data-source concept — proven with arbitrary field names", () => {
    const arbitrary: ReportRow[] = [
      { anyRowField: "A", anyColField: "X" },
      { anyRowField: "A", anyColField: "Y" },
      { anyRowField: "B", anyColField: "X" },
    ]
    const spec: PivotSpec = {
      aggregation: "count",
      rowDimension: { field: "anyRowField", bucket: "category" },
      columnDimension: { field: "anyColField", bucket: "category" },
    }
    const result = computePivotAnalytics(arbitrary, spec)
    expect(result.cells).toHaveLength(3)
  })
})
