import { describe, expect, it } from "vitest"

import { canTransition, isPeriodEditable, nextStatus, previousStatus } from "@/lib/payroll/payroll-workflow"
import { sumAdjustments, validateAdjustment } from "@/lib/payroll/payroll-adjustments"

describe("payroll workflow", () => {
  it("moves forward one step at a time", () => {
    expect(nextStatus("DRAFT")).toBe("CALCULATED")
    expect(nextStatus("PAID")).toBe("CLOSED")
    expect(nextStatus("CLOSED")).toBeNull()
    expect(canTransition("DRAFT", "APPROVED")).toBe(false)
  })

  it("allows stepping back only before payment", () => {
    expect(previousStatus("APPROVED")).toBe("CALCULATED")
    expect(previousStatus("CALCULATED")).toBe("DRAFT")
    expect(previousStatus("DRAFT")).toBeNull()
    expect(previousStatus("PAID")).toBeNull()
    expect(canTransition("CLOSED", "PAID")).toBe(false)
  })

  it("locks editing from APPROVED on", () => {
    expect(isPeriodEditable("DRAFT")).toBe(true)
    expect(isPeriodEditable("CALCULATED")).toBe(true)
    expect(isPeriodEditable("APPROVED")).toBe(false)
    expect(isPeriodEditable("CLOSED")).toBe(false)
  })
})

describe("payroll adjustments", () => {
  it("validates kind, category, amount and note", () => {
    expect(validateAdjustment({ kind: "ADDITION", category: "bonus", amount: 50 })).toBeNull()
    expect(validateAdjustment({ kind: "DEDUCTION", category: "bonus", amount: 50 })).toBe("category")
    expect(validateAdjustment({ kind: "X", category: "bonus", amount: 50 })).toBe("kind")
    expect(validateAdjustment({ kind: "ADDITION", category: "other", amount: 0 })).toBe("amount")
    expect(validateAdjustment({ kind: "ADDITION", category: "other", amount: NaN })).toBe("amount")
    expect(validateAdjustment({ kind: "ADDITION", category: "other", amount: 5, note: "x".repeat(301) })).toBe("note")
  })

  it("sums additions and deductions with cent rounding", () => {
    expect(
      sumAdjustments([
        { kind: "ADDITION", amount: 0.1 },
        { kind: "ADDITION", amount: 0.2 },
        { kind: "DEDUCTION", amount: 10.25 },
      ])
    ).toEqual({ additions: 0.3, deductions: 10.25 })
  })
})
