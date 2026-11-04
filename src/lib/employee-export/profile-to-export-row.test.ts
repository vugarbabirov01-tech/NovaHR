import { describe, expect, it } from "vitest"

import { profileToExportRow } from "@/lib/employee-export/profile-to-export-row"
import { withTestEmployee } from "@/lib/leave/leave-test-fixtures"

/**
 * Regression coverage for the "Import Template export gives English"
 * report: gender/maritalStatus/employmentType/contractType/workLocationType
 * used to be written as their raw internal codes ("female", "full-time",
 * "hybrid", ...) straight from EmployeeProfile, unlike every other closed-
 * choice field on this same row.
 *
 * Uses withTestEmployee("EMP-1042", ...) — a throwaway employee cloned
 * from that seedEmployeeDirectory template (the exact gender/maritalStatus/
 * employmentType/contractType/workLocationType values this test asserts
 * against come from that template), created via the real createEmployee()
 * and removed via the real deleteEmployees() regardless of outcome. A
 * previous version of this test called findEmployeeById("EMP-1042")
 * directly, assuming that literal id still existed in dev.db — it stopped
 * existing once the real company import replaced the old in-memory
 * seedEmployeeDirectory with real 6-digit Prisma-backed ids. This is the
 * same fixture-isolation fix already applied to the Leave test suite's
 * own stale-id failures.
 */
describe("profileToExportRow", () => {
  it("writes the canonical Azerbaijani label for every closed-choice field, not the raw internal code", async () => {
    await withTestEmployee("EMP-1042", async (profile) => {
      expect(profile.personal.gender).toBe("female")
      expect(profile.personal.maritalStatus).toBe("married")
      expect(profile.employment.employmentType).toBe("full-time")
      expect(profile.employment.contractType).toBe("permanent")
      expect(profile.employment.workLocationType).toBe("hybrid")

      const row = profileToExportRow(profile, "importTemplate")

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
  })

  it("applies the same translation for the fullReport export type", async () => {
    await withTestEmployee("EMP-1042", async (profile) => {
      const row = profileToExportRow(profile, "fullReport")
      expect(row.gender).toBe("Qadın")
      expect(row.employmentType).toBe("Tam ştat")
    })
  })
})
