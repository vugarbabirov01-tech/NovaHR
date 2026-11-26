import { describe, expect, it } from "vitest"

import {
  applyWorkBookReview,
  reviewBlocker,
  validateWorkBookReview,
  type WorkBookReviewInput,
} from "@/lib/experience/work-book-review"
import {
  actualCompanyService,
  analyzeWorkBookPeriods,
  companyStart,
  protectExperience,
  resolveExperience,
  reviewReasons,
  startWithoutExperience,
} from "@/lib/experience/work-experience"
import type { EmployeeProfile, WorkBookExperience } from "@/types/employee-profile"

const NOW = new Date("2026-11-26T00:00:00Z")
const d = (years: number, months = 0, days = 0) => ({ years, months, days })

function profile(labourLaw: Partial<EmployeeProfile["labourLaw"]> = {}, hireDate = "2020-01-01"): EmployeeProfile {
  return {
    id: "EMP-TEST",
    personal: { gender: "male", dateOfBirth: "1980-01-01" },
    employment: { hireDate },
    labourLaw: {
      children: [],
      hasDisability: false,
      hazardousWork: false,
      undergroundWork: false,
      hasCollectiveAgreementLeave: false,
      companyAdditionalLeaveDays: 0,
      previousWorkExperience: d(3),
      officialPreviousExperience: d(3),
      previousEmployments: [
        { id: "1", organization: "A", startDate: "2015-01-01", endDate: "2017-12-31", counted: true },
      ],
      ...labourLaw,
    },
    leave: { annualLeaveEntitlement: 21, additionalLeaveEntitlement: 0, usedLeaveDays: 0 },
    auditLog: [],
  } as unknown as EmployeeProfile
}

const book = (over: Partial<WorkBookExperience>): WorkBookExperience => ({ status: "confirmed", periods: [], ...over })
const period = (startDate: string, endDate: string) => ({ id: startDate, organization: "B", startDate, endDate })

describe("resolveExperience", () => {
  it("uses only ƏMAS until HR confirms the work book", () => {
    for (const status of ["pending", "rejected"] as const) {
      const p = profile({ workBook: book({ status, declaredTotal: d(10) }) })
      expect(resolveExperience(p, NOW).effective).toEqual(d(3))
    }
  })

  it("takes the larger of the two totals, never their sum", () => {
    expect(resolveExperience(profile({ workBook: book({ declaredTotal: d(10) }) }), NOW).effective).toEqual(d(10))
    expect(resolveExperience(profile({ workBook: book({ declaredTotal: d(2) }) }), NOW).effective).toEqual(d(3))
  })

  it("adds a work-book period that ƏMAS does not know about", () => {
    const p = profile({ workBook: book({ periods: [period("2010-01-01", "2011-12-31")] }) })
    expect(resolveExperience(p, NOW).effective).toEqual(d(5))
  })

  it("counts only the part of a period ƏMAS has not counted", () => {
    // 2014..2016 overlaps ƏMAS 2015..2016; only 2014 is new.
    const p = profile({ workBook: book({ periods: [period("2014-01-01", "2016-12-31")] }) })
    const result = resolveExperience(p, NOW)
    expect(result.effective).toEqual(d(4))
    expect(result.periods?.overlapEmasDays).toBe(731)
  })

  it("adds nothing for a period fully inside ƏMAS or the current contract", () => {
    const p = profile({
      workBook: book({ periods: [period("2015-03-01", "2015-05-01"), period("2021-01-01", "2022-01-01")] }),
    })
    const result = resolveExperience(p, NOW)
    expect(result.effective).toEqual(d(3))
    expect(result.periods?.overlapCurrentDays).toBeGreaterThan(300)
  })

  it("counts a day once when work-book periods overlap each other", () => {
    const once = analyzeWorkBookPeriods([period("2010-01-01", "2010-12-31")], profile(), NOW)
    const twice = analyzeWorkBookPeriods(
      [period("2010-01-01", "2010-12-31"), period("2010-03-01", "2010-09-30")],
      profile(),
      NOW
    )
    expect(twice.addedDays).toBe(once.addedDays)
  })
})

describe("reviewReasons", () => {
  it("flags experience present in both sources", () => {
    const p = profile({ workBook: book({ status: "pending", declaredTotal: d(9) }) })
    expect(reviewReasons(p, NOW)).toContain("bothSources")
  })

  it("flags an excess that looks like the current job", () => {
    // About 6 years 11 months since hire; declared exceeds ƏMAS by about the same.
    const p = profile({ workBook: book({ status: "pending", declaredTotal: d(9, 11) }) })
    expect(reviewReasons(p, NOW)).toContain("likelyDuplicate")
  })

  it("flags a total equal to the current job, even when ƏMAS also has experience", () => {
    // About 6 years 11 months at the company.
    for (const declared of [d(6, 11), d(9, 11)]) {
      const p = profile({ workBook: book({ status: "pending", declaredTotal: declared }) })
      expect(reviewReasons(p, NOW)).toContain("likelyDuplicate")
    }
  })

  it("keeps the warning as time passes, measuring on the date the figure was stated", () => {
    const p = profile({ workBook: book({ status: "pending", declaredTotal: d(6, 11), declaredAsOf: "2026-11-24" }) })
    expect(reviewReasons(p, new Date("2028-06-01T00:00:00Z"))).toContain("likelyDuplicate")
  })

  it("does not flag an unrelated figure", () => {
    const p = profile({ workBook: book({ status: "pending", declaredTotal: d(15) }) })
    expect(reviewReasons(p, NOW)).not.toContain("likelyDuplicate")
  })

  it("has nothing to say when HR's figure is not larger", () => {
    expect(reviewReasons(profile({ workBook: book({ declaredTotal: d(3) }) }), NOW)).toEqual([])
  })
})

describe("actualCompanyService", () => {
  it("counts from the actual start and flags a year-only value", () => {
    expect(actualCompanyService({ actualStartDate: "2008-11-26" }, NOW)).toEqual({ duration: d(18), approximate: false })
    expect(actualCompanyService({ actualStartDate: "2008" }, NOW)?.approximate).toBe(true)
    expect(actualCompanyService({}, NOW)).toBeUndefined()
  })

  it("never changes the experience leave is calculated from", () => {
    const p = profile()
    p.employment.actualStartDate = "2001-01-01"
    expect(resolveExperience(p, NOW).effective).toEqual(d(3))
  })
})

describe("companyStart", () => {
  it("prefers the recorded actual start and falls back to the hire date", () => {
    expect(companyStart({ hireDate: "2017-03-01", actualStartDate: "2008-05-10" })).toEqual({ date: "2008-05-10", approximate: false })
    expect(companyStart({ hireDate: "2017-03-01", actualStartDate: "2008" })).toEqual({ date: "2008-01-01", approximate: true })
    expect(companyStart({ hireDate: "2017-03-01" })).toEqual({ date: "2017-03-01", approximate: false })
  })

  it("keeps the hire date when only the same year is known", () => {
    expect(companyStart({ hireDate: "2017-03-01", actualStartDate: "2017" })?.date).toBe("2017-03-01")
  })
})

describe("protection of ƏMAS data", () => {
  it("ignores experience typed into an ordinary edit", () => {
    const existing = profile()
    const incoming = profile({
      previousWorkExperience: d(40),
      officialPreviousExperience: d(40),
      previousEmployments: [],
    })
    const saved = protectExperience(existing, incoming)
    expect(saved.labourLaw.previousWorkExperience).toEqual(d(3))
    expect(saved.labourLaw.officialPreviousExperience).toEqual(d(3))
    expect(saved.labourLaw.previousEmployments).toHaveLength(1)
  })

  it("starts a new record with no experience", () => {
    expect(startWithoutExperience(profile()).labourLaw.previousWorkExperience).toEqual(d(0))
  })

  it("a review changes the work book and derived figures, not ƏMAS", () => {
    const input: WorkBookReviewInput = {
      status: "confirmed",
      declaredTotal: d(12),
      periods: [],
      note: "Əmək kitabçası",
      reviewedBy: "HR",
    }
    const out = applyWorkBookReview(profile(), input, NOW)
    expect(out.profile.labourLaw.officialPreviousExperience).toEqual(d(3))
    expect(out.profile.labourLaw.previousEmployments).toHaveLength(1)
    expect(out.effective).toEqual(d(12))
    // 6 years here + 3 = tier 5-10 (+2); + 12 = tier 15+ (+6).
    expect(out.leaveDaysAfter - out.leaveDaysBefore).toBe(4)
    expect(out.profile.auditLog).toHaveLength(1)
  })

  it("pins the official figure for a record that had none", () => {
    const old = profile({ officialPreviousExperience: undefined })
    const out = applyWorkBookReview(
      old,
      { status: "confirmed", declaredTotal: d(8), periods: [], note: "n", reviewedBy: "HR" },
      NOW
    )
    expect(out.profile.labourLaw.officialPreviousExperience).toEqual(d(3))
  })
})

describe("reviewBlocker", () => {
  const input = (over: Partial<WorkBookReviewInput>): WorkBookReviewInput => ({
    status: "confirmed",
    declaredTotal: d(6, 11),
    periods: [],
    note: "n",
    reviewedBy: "HR",
    ...over,
  })

  it("demands dated periods before a suspicious total is confirmed", () => {
    expect(reviewBlocker(profile(), input({}), NOW)).toBe("periodsRequired")
  })

  it("lets periods, rejection and unrelated totals through", () => {
    const withPeriod = input({
      periods: [{ organization: "B", position: "", startDate: "2000-01-01", endDate: "2001-01-01" }],
    })
    expect(reviewBlocker(profile(), withPeriod, NOW)).toBeNull()
    expect(reviewBlocker(profile(), input({ status: "rejected" }), NOW)).toBeNull()
    expect(reviewBlocker(profile(), input({ declaredTotal: d(15) }), NOW)).toBeNull()
  })
})

describe("validateWorkBookReview", () => {
  const ok: WorkBookReviewInput = {
    status: "confirmed",
    declaredTotal: d(1),
    periods: [],
    note: "n",
    reviewedBy: "HR",
  }
  const check = (over: Partial<WorkBookReviewInput>) => validateWorkBookReview({ ...ok, ...over }, "2026-11-26")
  const row = (startDate: string, endDate: string) => ({ organization: "B", position: "", startDate, endDate })

  it("accepts a complete decision", () => {
    expect(check({})).toBeNull()
  })

  it("rejects incomplete or impossible input", () => {
    expect(check({ reviewedBy: " " })).toBe("reviewerRequired")
    expect(check({ note: "" })).toBe("noteRequired")
    expect(check({ declaredTotal: d(0) })).toBe("nothingToConfirm")
    expect(check({ declaredTotal: d(1, 12) })).toBe("invalidTotal")
    expect(check({ periods: [row("2020-02-30", "2020-03-01")] })).toBe("invalidPeriodDate")
    expect(check({ periods: [row("2020-03-01", "2020-02-01")] })).toBe("periodOrder")
    expect(check({ periods: [row("2026-01-01", "2027-01-01")] })).toBe("futurePeriod")
  })
})
