import { describe, expect, it } from "vitest"

import { calculateReturnToWork } from "@/lib/leave/leave-policy-resolution-service"
import { evaluateLeaveRequest } from "@/lib/leave/leave-request-service"
import { getEmployeeById } from "@/data/employee-directory"
import { findActiveLeaveTypes } from "@/repositories/leave-type-repository"

/**
 * Regression coverage for the Leave Request Review screen's date/business
 * logic bug: `startOfDay`/`addDays` mutate via local-timezone setters
 * (setHours/setDate), but the old `toDateOnlyIso` read the result back via
 * `.toISOString()` (UTC) — in any timezone ahead of UTC (this deployment
 * runs Asia/Baku, UTC+4) that silently rolled every derived date back one
 * calendar day. A user picking 03.08.2026 saw 02.08.2026 on Review.
 *
 * No workScheduleLabel is passed to calculateReturnToWork here on purpose —
 * that falls back to LEAVE_SETTINGS.defaultWorkingDays (Mon-Fri), keeping
 * this test deterministic and independent of any specific employee's
 * schedule. There are no holidays seeded between Aug and Nov 2026 in this
 * environment, confirmed separately, so the expected values below assume a
 * plain Mon-Fri week with no holiday adjustment.
 */
describe("calculateReturnToWork — 03.08.2026, 46 days", () => {
  it("preserves the exact selected local start date (no UTC off-by-one)", async () => {
    const result = await calculateReturnToWork(new Date("2026-08-03"), 46, {})
    expect(result.startDate).toBe("2026-08-03")
  })

  it("derives the end date from start date + duration, not shifted a day backward", async () => {
    const result = await calculateReturnToWork(new Date("2026-08-03"), 46, {})
    expect(result.lastLeaveDay).toBe("2026-09-17")
  })

  it("sets Return To Work to the next working day after the end date", async () => {
    const result = await calculateReturnToWork(new Date("2026-08-03"), 46, {})
    // 2026-09-18 is a Friday — the very next calendar day, no weekend/holiday to skip.
    expect(result.returnToWorkDate).toBe("2026-09-18")
  })

  it("calculates calendar days as the actual span, not an echo of the input", async () => {
    const result = await calculateReturnToWork(new Date("2026-08-03"), 46, {})
    expect(result.calendarDays).toBe(46)
    // Proof it's a real calculation, not `numberOfDays` echoed straight
    // through: independently, span = (lastLeaveDay - startDate) + 1 day.
    const start = new Date(`${result.startDate}T00:00:00`)
    const end = new Date(`${result.lastLeaveDay}T00:00:00`)
    const spanDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
    expect(result.calendarDays).toBe(spanDays)
  })

  it("calculates working days from the schedule, excluding weekends", async () => {
    const result = await calculateReturnToWork(new Date("2026-08-03"), 46, {})
    expect(result.workingDaysInRange).toBe(34)
    expect(result.weekendDaysInRange).toBe(12)
    expect(result.workingDaysInRange + result.weekendDaysInRange).toBe(result.calendarDays)
  })

  it("is stable across the whole range — no drift from walking many days", async () => {
    // A regression this specific for an off-by-one bug: run it again with a
    // different but overlapping start date to confirm nothing is order- or
    // call-sequence-dependent.
    const shifted = await calculateReturnToWork(new Date("2026-08-04"), 46, {})
    expect(shifted.startDate).toBe("2026-08-04")
    expect(shifted.lastLeaveDay).toBe("2026-09-18")
  })
})

describe("evaluateLeaveRequest — balance preview reflects the request being submitted", () => {
  it("preserves the exact start date through the full preview pipeline", async () => {
    const annual = (await findActiveLeaveTypes()).find((t) => t.code === "ANNUAL")
    expect(annual).toBeDefined()

    const evaluation = await evaluateLeaveRequest("EMP-1042", annual!.id, new Date("2026-08-03"), 46)
    expect(evaluation.startDate).toBe("2026-08-03")
    expect(evaluation.returnToWork.startDate).toBe("2026-08-03")
  })

  it("recomputes the balance and date fields per-request rather than reusing stale values", async () => {
    const employee = getEmployeeById("EMP-1042")
    expect(employee).toBeDefined()
    const annual = (await findActiveLeaveTypes()).find((t) => t.code === "ANNUAL")
    expect(annual).toBeDefined()

    const shortRequest = await evaluateLeaveRequest("EMP-1042", annual!.id, new Date("2026-08-03"), 5)
    const longRequest = await evaluateLeaveRequest("EMP-1042", annual!.id, new Date("2026-08-03"), 46)

    // Balance is scoped to employee + leave type + start date, so it's
    // identical regardless of how many days are requested...
    expect(shortRequest.balance.remaining).toBe(longRequest.balance.remaining)
    expect(shortRequest.balance.employeeId).toBe("EMP-1042")
    expect(shortRequest.balance.leaveTypeId).toBe(annual!.id)

    // ...but the request-specific fields must differ, proving the preview
    // is actually recalculated per-request, not cached/echoed.
    expect(shortRequest.returnToWork.lastLeaveDay).not.toBe(longRequest.returnToWork.lastLeaveDay)
    expect(shortRequest.numberOfDays).toBe(5)
    expect(longRequest.numberOfDays).toBe(46)

    // "Remaining After Approval" (balance.remaining - numberOfDays, added to
    // the Review screen) must therefore also differ between the two.
    const shortRemainingAfterApproval = shortRequest.balance.remaining - shortRequest.numberOfDays
    const longRemainingAfterApproval = longRequest.balance.remaining - longRequest.numberOfDays
    expect(shortRemainingAfterApproval).not.toBe(longRemainingAfterApproval)
    expect(longRemainingAfterApproval).toBe(shortRemainingAfterApproval - 41)
  })
})
