import { describe, expect, it } from "vitest"

import {
  activePenalty,
  disciplineExpiryDate,
  isDisciplineInForce,
  validateDisciplineInput,
} from "@/lib/discipline/discipline-rules"

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
  it("lasts six months from the day imposed, clamping short months", () => {
    expect(disciplineExpiryDate("2026-03-15")).toBe("2026-09-15")
    expect(disciplineExpiryDate("2026-11-17")).toBe("2027-05-17")
    expect(disciplineExpiryDate("2026-08-31")).toBe("2027-02-28")
    expect(disciplineExpiryDate("2027-08-31")).toBe("2028-02-29")
  })

  it("is in force through the last day and lifted after it", () => {
    expect(isDisciplineInForce("2026-03-15", "2026-09-15")).toBe(true)
    expect(isDisciplineInForce("2026-03-15", "2026-09-16")).toBe(false)
  })
})

describe("activePenalty", () => {
  const record = (type: string, issuedDate: string) => ({ type, issuedDate })

  it("flags a penalty in force and nothing once six months have passed", () => {
    expect(activePenalty([record("REPRIMAND", "2026-11-01")], "2026-11-26")).toEqual({
      type: "REPRIMAND",
      until: "2027-05-01",
    })
    expect(activePenalty([record("REPRIMAND", "2026-01-01")], "2026-11-26")).toBeUndefined()
  })

  it("flags a written warning for six months too", () => {
    expect(activePenalty([record("WARNING", "2026-11-20")], "2026-11-26")).toEqual({
      type: "WARNING",
      until: "2027-05-20",
    })
    expect(activePenalty([record("WARNING", "2026-01-01")], "2026-11-26")).toBeUndefined()
  })

  it("shows a penalty rather than a newer warning", () => {
    const records = [record("WARNING", "2026-11-25"), record("REPRIMAND", "2026-07-01")]
    expect(activePenalty(records, "2026-11-26")?.type).toBe("REPRIMAND")
  })

  it("prefers the more severe penalty, then the one lasting longest", () => {
    const records = [record("REPRIMAND", "2026-11-20"), record("SEVERE_REPRIMAND", "2026-07-01")]
    expect(activePenalty(records, "2026-11-26")?.type).toBe("SEVERE_REPRIMAND")
    const two = [record("REPRIMAND", "2026-10-01"), record("REPRIMAND", "2026-11-01")]
    expect(activePenalty(two, "2026-11-26")?.until).toBe("2027-05-01")
  })
})
