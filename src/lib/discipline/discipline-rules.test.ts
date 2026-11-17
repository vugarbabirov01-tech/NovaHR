import { describe, expect, it } from "vitest"

import { disciplineExpiryDate, isDisciplineInForce, validateDisciplineInput } from "@/lib/discipline/discipline-rules"

const ok = { type: "REPRIMAND", issuedDate: "2026-11-10", violationDate: "2026-11-05", reason: "Gecikmə" }

describe("validateDisciplineInput", () => {
  it("accepts a complete, consistent record", () => {
    expect(validateDisciplineInput(ok, "2026-11-17")).toBeNull()
    expect(validateDisciplineInput({ ...ok, issuedDate: "2026-11-05" }, "2026-11-17")).toBeNull()
  })

  it("rejects unknown types and malformed or impossible dates", () => {
    expect(validateDisciplineInput({ ...ok, type: "FIRED" }, "2026-11-17")).toBe("invalidType")
    expect(validateDisciplineInput({ ...ok, issuedDate: "10.11.2026" }, "2026-11-17")).toBe("invalidDate")
    expect(validateDisciplineInput({ ...ok, violationDate: "2026-02-31" }, "2026-11-17")).toBe("invalidDate")
  })

  it("rejects future dates and a measure dated before the violation", () => {
    expect(validateDisciplineInput({ ...ok, issuedDate: "2026-12-01" }, "2026-11-17")).toBe("futureDate")
    expect(validateDisciplineInput({ ...ok, issuedDate: "2026-11-01" }, "2026-11-17")).toBe("issuedBeforeViolation")
  })

  it("requires a reason", () => {
    expect(validateDisciplineInput({ ...ok, reason: "   " }, "2026-11-17")).toBe("reasonRequired")
  })
})

describe("force period", () => {
  it("expires one year after the measure, clamping 29 February", () => {
    expect(disciplineExpiryDate("2026-03-15")).toBe("2027-03-15")
    expect(disciplineExpiryDate("2024-02-29")).toBe("2025-02-28")
  })

  it("is in force through the expiry day and lifted after it", () => {
    expect(isDisciplineInForce("2026-03-15", "2027-03-15")).toBe(true)
    expect(isDisciplineInForce("2026-03-15", "2027-03-16")).toBe(false)
  })
})
