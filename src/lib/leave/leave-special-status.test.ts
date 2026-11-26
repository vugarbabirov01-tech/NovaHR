import { describe, expect, it } from "vitest"

import { AZ_LABOUR_CODE_LEAVE_RULES } from "@/lib/leave/leave-labour-code-rules"
import { resolveAnnualLeaveEntitlement } from "@/lib/leave/leave-policy-resolution-service"
import type { EmployeeProfile } from "@/types/employee-profile"

const NOW = new Date("2026-11-26T00:00:00Z")
const { DISABLED_EMPLOYEE_LEAVE_DAYS: DISABLED, SPECIAL_SERVICE_LEAVE_DAYS: VETERAN } = AZ_LABOUR_CODE_LEAVE_RULES

function profile(labourLaw: Partial<EmployeeProfile["labourLaw"]>): EmployeeProfile {
  return {
    personal: { gender: "male", dateOfBirth: "1980-01-01" },
    employment: { hireDate: "2010-01-01" },
    labourLaw: {
      children: [],
      hasDisability: false,
      hazardousWork: false,
      undergroundWork: false,
      hasCollectiveAgreementLeave: false,
      companyAdditionalLeaveDays: 0,
      previousWorkExperience: { years: 0, months: 0, days: 0 },
      ...labourLaw,
    },
  } as unknown as EmployeeProfile
}

const resolve = (labourLaw: Partial<EmployeeProfile["labourLaw"]>) =>
  resolveAnnualLeaveEntitlement(profile(labourLaw), NOW)

describe("special-status base leave", () => {
  it("gives a disabled employee and a veteran their own figures", () => {
    expect(resolve({ hasDisability: true }).totalDays).toBe(DISABLED)
    expect(resolve({ veteranStatus: "warVeteran" }).totalDays).toBe(VETERAN)
  })

  it("gives someone who is both the larger figure only", () => {
    const both = resolve({ hasDisability: true, veteranStatus: "warVeteran" })
    expect(both.totalDays).toBe(Math.max(DISABLED, VETERAN))
    expect(both.components.map((c) => c.article)).toEqual(["Art. 120"])
  })

  it("does not stack seniority on a special-status base", () => {
    // 16 years here would add days to an ordinary base.
    expect(resolve({ hasDisability: true }).components).toHaveLength(1)
    expect(resolve({}).components.length).toBeGreaterThan(1)
  })
})
