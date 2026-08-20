import { describe, expect, it } from "vitest"

import { formatLeavePeriod, generateLeavePeriodOptions } from "@/lib/leave/leave-period"

describe("formatLeavePeriod", () => {
  it("formats a start year as an en-dash-joined consecutive range", () => {
    expect(formatLeavePeriod(2025)).toBe("2025–2026")
    expect(formatLeavePeriod(2026)).toBe("2026–2027")
  })
})

describe("generateLeavePeriodOptions", () => {
  it("generates the 5 previous/current periods plus 1 upcoming period, for the year 2026", () => {
    const options = generateLeavePeriodOptions(new Date("2026-08-20"))
    expect(options.map((o) => o.startYear)).toEqual([2022, 2023, 2024, 2025, 2026, 2027])
    expect(options.map((o) => o.label)).toEqual([
      "2022–2023",
      "2023–2024",
      "2024–2025",
      "2025–2026",
      "2026–2027",
      "2027–2028",
    ])
  })

  it("never includes a period from outside the current window (e.g. 2020–2021 does not appear in 2026)", () => {
    const options = generateLeavePeriodOptions(new Date("2026-01-01"))
    expect(options.map((o) => o.label)).not.toContain("2020–2021")
  })

  it("is oldest-first and always consecutive — the next period is always +1 year", () => {
    const options = generateLeavePeriodOptions(new Date("2030-01-01"))
    for (let i = 1; i < options.length; i++) {
      expect(options[i].startYear).toBe(options[i - 1].startYear + 1)
    }
  })

  it("shifts the whole window forward by exactly one year when the year advances by one", () => {
    const options2026 = generateLeavePeriodOptions(new Date("2026-06-01"))
    const options2027 = generateLeavePeriodOptions(new Date("2027-06-01"))
    expect(options2027.map((o) => o.startYear)).toEqual(options2026.map((o) => o.startYear + 1))
  })

  it("always has the current year's period as the second-to-last (5th of 6) entry", () => {
    const currentYear = 2031
    const options = generateLeavePeriodOptions(new Date(`${currentYear}-03-15`))
    expect(options).toHaveLength(6)
    expect(options[4].startYear).toBe(currentYear)
    expect(options[5].startYear).toBe(currentYear + 1)
  })
})
