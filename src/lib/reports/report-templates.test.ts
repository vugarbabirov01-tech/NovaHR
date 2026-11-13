import { describe, expect, it } from "vitest"

import { REPORT_TEMPLATES, REPORT_TEMPLATE_CATEGORIES } from "@/lib/reports/report-templates"
import { reportDefinitionInputSchema } from "@/lib/validation/reports"

describe("report templates", () => {
  it("have unique ids and a known category", () => {
    const ids = REPORT_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of REPORT_TEMPLATES) expect(REPORT_TEMPLATE_CATEGORIES).toContain(t.category)
  })

  it.each(REPORT_TEMPLATES.map((t) => [t.id, t] as const))("%s passes the same validation as a saved report", (_id, t) => {
    const parsed = reportDefinitionInputSchema.safeParse({
      name: t.id,
      dataSource: t.dataSource,
      columns: t.columns,
      filters: t.filters,
      sortBy: t.sortBy,
      sortDirection: t.sortDirection,
      kpis: t.kpis,
      chartConfig: t.chartConfig,
    })
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues)).toBe(true)
  })

  it("contain no salary fields", () => {
    const text = JSON.stringify(REPORT_TEMPLATES).toLowerCase()
    expect(text).not.toContain("salary")
    expect(text).not.toContain("payroll")
  })
})
