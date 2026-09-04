import { describe, expect, it } from "vitest"

import { profileToExportRow } from "@/lib/employee-export/profile-to-export-row"
import { getEmployeeById } from "@/data/employee-directory"

/**
 * Regression coverage for the "Import Template export gives English"
 * report: gender/maritalStatus/employmentType/contractType/workLocationType
 * used to be written as their raw internal codes ("female", "full-time",
 * "hybrid", ...) straight from EmployeeProfile, unlike every other closed-
 * choice field on this same row. Reuses a real seeded profile (EMP-1042)
 * rather than a hand-built mock — same pattern leave-request-date-
 * calculations.test.ts already uses.
 */
describe("profileToExportRow", () => {
  it("writes the canonical Azerbaijani label for every closed-choice field, not the raw internal code", () => {
    const profile = getEmployeeById("EMP-1042")
    expect(profile).toBeDefined()
    expect(profile!.personal.gender).toBe("female")
    expect(profile!.personal.maritalStatus).toBe("married")
    expect(profile!.employment.employmentType).toBe("full-time")
    expect(profile!.employment.contractType).toBe("permanent")
    expect(profile!.employment.workLocationType).toBe("hybrid")

    const row = profileToExportRow(profile!, "importTemplate")

    expect(row.gender).toBe("Qadın")
    expect(row.maritalStatus).toBe("Evli")
    expect(row.employmentType).toBe("Tam ştat")
    expect(row.contractType).toBe("Müddətsiz")
    expect(row.workLocationType).toBe("Hibrid iş rejimi")

    // None of the raw English/hyphenated internal codes should leak through.
    for (const value of [row.gender, row.maritalStatus, row.employmentType, row.contractType, row.workLocationType]) {
      expect(value).not.toMatch(/^(male|female|single|married|divorced|widowed|full-time|part-time|permanent|on-site|remote|hybrid)$/)
    }
  })

  it("applies the same translation for the fullReport export type", () => {
    const profile = getEmployeeById("EMP-1042")
    const row = profileToExportRow(profile!, "fullReport")
    expect(row.gender).toBe("Qadın")
    expect(row.employmentType).toBe("Tam ştat")
  })
})
