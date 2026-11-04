import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchPayrollReportRows } from "@/lib/reports/payroll-report-data-source"

describe("fetchPayrollReportRows", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns no rows at all in production — the dev-only guard, not just a UI hint", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const rows = await fetchPayrollReportRows()
    expect(rows).toEqual([])
  })

  it("returns real rows outside production, with no financial field on any row", async () => {
    vi.stubEnv("NODE_ENV", "test")
    const rows = await fetchPayrollReportRows()
    expect(rows.length).toBeGreaterThan(0)
    const financialKeys = ["baseSalary", "additions", "deductions", "grossAmount", "netAmount", "currency", "bankAccountNumber"]
    for (const row of rows) {
      for (const key of financialKeys) {
        expect(row).not.toHaveProperty(key)
      }
      expect(typeof row.payrollYear).toBe("number")
      expect(typeof row.payrollMonth).toBe("number")
    }
  })
})
