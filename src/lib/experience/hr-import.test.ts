import { describe, expect, it } from "vitest"

import {
  buildPeriods,
  computeHrImport,
  HR_COL,
  parseActualStart,
  parseDurationText,
  PERIOD_COL,
  type SheetRow,
} from "@/lib/experience/hr-import"
import type { EmployeeProfile } from "@/types/employee-profile"

const NOW = new Date("2026-11-26T00:00:00Z")
const d = (years: number, months = 0, days = 0) => ({ years, months, days })
// Excel serial for 2017-04-01.
const HIRE_SERIAL = 42826

function profile(): EmployeeProfile {
  return {
    id: "EMP-TEST",
    personal: { finCode: "TEST123", gender: "male", dateOfBirth: "1980-01-01" },
    employment: { hireDate: "2017-04-01" },
    labourLaw: {
      children: [],
      hasDisability: false,
      hazardousWork: false,
      undergroundWork: false,
      hasCollectiveAgreementLeave: false,
      companyAdditionalLeaveDays: 0,
      previousWorkExperience: d(0),
    },
    leave: { annualLeaveEntitlement: 21, additionalLeaveEntitlement: 0, usedLeaveDays: 0 },
    auditLog: [],
  } as unknown as EmployeeProfile
}

const row = (over: SheetRow = {}): SheetRow => ({
  [HR_COL.hireDate]: HIRE_SERIAL,
  [HR_COL.actualStart]: "2008",
  [HR_COL.declaredTotal]: "8 il 1 ay 5 gün",
  [HR_COL.official]: "1 il 2 ay 3 gün",
  [HR_COL.disability]: "Məlumat yoxdur",
  [HR_COL.veteran]: "Məlumat yoxdur",
  ...over,
})

describe("parsers", () => {
  it("reads durations, including untidy ones", () => {
    expect(parseDurationText("5 il 1 ay 5 gün")).toEqual(d(5, 1, 5))
    expect(parseDurationText("9 ay")).toEqual(d(0, 9))
    expect(parseDurationText("10 iyun (4 il 8 ay 19 gün)")).toEqual(d(4, 8, 19))
    expect(parseDurationText("12 il (28.02.2014)")).toEqual(d(12))
    expect(parseDurationText("Məlumat yoxdur")).toBeUndefined()
  })

  it("reads an actual start as a date or a bare year", () => {
    expect(parseActualStart(2008)).toBe("2008")
    expect(parseActualStart("2008")).toBe("2008")
    expect(parseActualStart(HIRE_SERIAL)).toBe("2017-04-01")
    expect(parseActualStart("01.05.2021")).toBe("2021-05-01")
    expect(parseActualStart("bilinmir")).toBeUndefined()
  })

  it("uses the counted part of a period and flags the own company", () => {
    const periods = buildPeriods("X", [
      {
        [PERIOD_COL.organization]: "A",
        [PERIOD_COL.taxId]: "1301709881",
        [PERIOD_COL.start]: 40000,
        [PERIOD_COL.end]: 43000,
        [PERIOD_COL.counted]: "Bəli",
        [PERIOD_COL.countedPeriod]: "06.07.2009 – 31.03.2017",
      },
    ])
    expect(periods[0]).toMatchObject({ startDate: "2009-07-06", endDate: "2017-03-31", ownCompany: true })
  })
})

describe("computeHrImport", () => {
  it("stores ƏMAS as official, HR's larger figure as pending and the actual start apart", () => {
    const out = computeHrImport(profile(), row(), [], NOW)
    expect(out.profile.labourLaw.officialPreviousExperience).toEqual(d(1, 2, 3))
    expect(out.profile.labourLaw.workBook).toMatchObject({ status: "pending", declaredTotal: d(8, 1, 5) })
    // Not confirmed yet: leave uses ƏMAS only.
    expect(out.profile.labourLaw.previousWorkExperience).toEqual(d(1, 2, 3))
    expect(out.profile.employment.actualStartDate).toBe("2008")
    expect(out.leaveDaysIfConfirmed).toBeGreaterThan(out.leaveDaysAfter)
  })

  it("ignores an HR figure smaller than ƏMAS", () => {
    const out = computeHrImport(profile(), row({ [HR_COL.declaredTotal]: "3 ay" }), [], NOW)
    expect(out.profile.labourLaw.workBook).toBeUndefined()
    expect(out.warnings.join()).toContain("kiçikdir")
  })

  it("is repeatable", () => {
    const first = computeHrImport(profile(), row(), [], NOW)
    expect(computeHrImport(first.profile, row(), [], NOW).changes).toEqual([])
  })

  it("never overwrites HR's decision", () => {
    const decided = computeHrImport(profile(), row(), [], NOW).profile
    decided.labourLaw.workBook = { status: "rejected", periods: [], reviewedBy: "HR" }
    const out = computeHrImport(decided, row(), [], NOW)
    expect(out.profile.labourLaw.workBook?.status).toBe("rejected")
  })

  it("does not store an actual start later than the hire date", () => {
    const out = computeHrImport(profile(), row({ [HR_COL.actualStart]: "2019" }), [], NOW)
    expect(out.profile.employment.actualStartDate).toBeUndefined()
  })

  it("records a disability ƏMAS knows about", () => {
    const out = computeHrImport(
      profile(),
      row({ [HR_COL.disability]: "Orqanizmin funksiyalarının 31-60 faiz pozulması" }),
      [],
      NOW
    )
    expect(out.profile.labourLaw).toMatchObject({ hasDisability: true, disabilityGroup: "III" })
    expect(out.leaveDaysAfter).toBeGreaterThan(out.leaveDaysBefore)
  })
})
