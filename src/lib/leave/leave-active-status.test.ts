import { describe, expect, it } from "vitest"

import { calendarDaysUntil } from "@/lib/leave/leave-active-status"

/**
 * Coverage for the Leave Dashboard's "Hazırda Məzuniyyətdə Olan İşçilər"
 * table — Qayıtma Gün Sayı (days-until-return) is exactly this function.
 * findActiveLeaveByEmployee already has coverage in
 * src/lib/employee-work-status.test.ts; not duplicated here.
 */
describe("calendarDaysUntil", () => {
  it("counts whole calendar days between today and a future date", () => {
    const now = new Date("2026-08-10T09:00:00")
    expect(calendarDaysUntil("2026-08-11", now)).toBe(1)
    expect(calendarDaysUntil("2026-08-17", now)).toBe(7)
    expect(calendarDaysUntil("2026-08-22", now)).toBe(12)
  })

  it("returns 0 when the target date is today", () => {
    const now = new Date("2026-08-10T18:00:00")
    expect(calendarDaysUntil("2026-08-10", now)).toBe(0)
  })

  it("is unaffected by the time-of-day component of `now`", () => {
    const morning = calendarDaysUntil("2026-08-15", new Date("2026-08-10T00:05:00"))
    const night = calendarDaysUntil("2026-08-15", new Date("2026-08-10T23:55:00"))
    expect(morning).toBe(5)
    expect(night).toBe(5)
  })

  it("returns a negative number once the target date is in the past", () => {
    const now = new Date("2026-08-10T09:00:00")
    expect(calendarDaysUntil("2026-08-08", now)).toBe(-2)
  })
})
