import { describe, expect, it } from "vitest"

import { summarizeEntitlement } from "@/lib/leave/entitlement-summary"
import type { AnnualLeaveEntitlementResult } from "@/lib/leave/leave-policy-resolution-service"

function result(components: AnnualLeaveEntitlementResult["components"]): AnnualLeaveEntitlementResult {
  const totalDays = components.filter((c) => c.source !== "gap").reduce((sum, c) => sum + c.days, 0)
  return { employeeId: "e1", asOfDate: "2026-11-13", totalDays, unit: "DAYS", components }
}

describe("summarizeEntitlement", () => {
  it("splits base, length-of-service and other additions", () => {
    const summary = summarizeEntitlement(
      result([
        { source: "company", article: "Contract Base", days: 30, description: "" },
        { source: "statutory", article: "Art. 116", days: 2, description: "" },
        { source: "company", article: "Company Policy", days: 3, description: "" },
        { source: "statutory", article: "Art. 117", days: 3, description: "" },
        { source: "gap", article: "Art. 118", days: 0, description: "" },
      ])
    )
    expect(summary).toEqual({ totalDays: 38, baseDays: 30, seniorityDays: 2, otherDays: 6 })
  })

  it("treats a special-status base as base days", () => {
    const summary = summarizeEntitlement(result([{ source: "statutory", article: "Art. 119.2", days: 42, description: "" }]))
    expect(summary).toEqual({ totalDays: 42, baseDays: 42, seniorityDays: 0, otherDays: 0 })
  })
})
