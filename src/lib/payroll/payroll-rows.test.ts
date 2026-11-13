import { describe, expect, it } from "vitest"

import { buildPayrollRows } from "@/lib/payroll/payroll-rows"
import type { PayrollEmployeeRecord } from "@/repositories/payroll-repository"
import type { EmployeeProfile } from "@/types/employee-profile"

function profile(id: string, last: string, gross?: number): EmployeeProfile {
  return {
    id,
    employmentStatus: "active",
    employment: {
      employeeNumber: id,
      hireDate: "2020-01-01",
      employmentType: "full-time",
      contractType: "permanent",
      department: "",
      position: "Fəhlə",
      grade: "",
      branch: "",
      company: "Co",
      workSchedule: "",
      workLocationType: "on-site",
      workLocation: "Park",
      history: [
        { id: "1", date: "2020-01-01", type: "hire", title: "Hired", description: "" },
        { id: "2", date: "2025-01-01", type: "salary-change", title: "500 → 600", description: "" },
        { id: "3", date: "2026-03-01", type: "salary-change", title: "600 → 700", description: "" },
      ],
    },
    personal: { firstName: "Ad", lastName: last, fatherName: "Ata", gender: "male", dateOfBirth: "", nationality: "", maritalStatus: "single", finCode: "FIN" + id, nationalId: "", passportNumber: "", address: "", phone: "", email: "", emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "" },
    labourLaw: { isPregnant: false, isSingleParent: false, isAdoptiveParent: false, children: [], hasDisability: false, hazardousWork: false, undergroundWork: false, nightShiftWork: false, isShiftWork: false, previousWorkExperience: { years: 0, months: 0, days: 0 }, hasCollectiveAgreementLeave: false, companyAdditionalLeaveDays: 0 },
    leave: { annualLeaveEntitlement: 21, additionalLeaveEntitlement: 0, usedLeaveDays: 0, remainingLeaveDays: 21, history: [] },
    payroll: { bankName: "", bankAccountNumber: "", baseSalary: 700, grossSalary: gross, currency: "AZN", bonus: 0, allowances: [] },
    documents: [],
    education: { schools: [], universities: [], certificates: [], languages: [], skills: [] },
    assets: [],
    notes: [],
    auditLog: [],
    quickStats: { tenureYears: 0, directReports: 0, completedTrainings: 0, openTasks: 0 },
  }
}

function record(employeeId: string): PayrollEmployeeRecord {
  return {
    id: "r" + employeeId,
    payrollPeriodId: "p",
    employeeId,
    baseSalary: 700,
    currency: "AZN",
    additions: 0,
    deductions: 0,
    grossAmount: 700,
    netAmount: 700,
    status: "DRAFT",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as PayrollEmployeeRecord
}

describe("buildPayrollRows", () => {
  it("joins records with employees, carries gross, sorts by name and drops orphans", () => {
    const rows = buildPayrollRows(
      [record("2"), record("1"), record("ghost")],
      [profile("1", "Zeynalov", 805), profile("2", "Abasov")]
    )
    expect(rows.map((r) => r.lastName)).toEqual(["Abasov", "Zeynalov"])
    expect(rows[0].grossSalary).toBeUndefined()
    expect(rows[1].grossSalary).toBe(805)
    expect(rows[1].fullName).toBe("Zeynalov Ad Ata")
  })

  it("exposes salary-change history newest first and never changes the net amount", () => {
    const [row] = buildPayrollRows([record("1")], [profile("1", "Abasov", 805)])
    expect(row.salaryHistory.map((e) => e.title)).toEqual(["600 → 700", "500 → 600"])
    expect(row.baseSalary).toBe(700)
    expect(row.netAmount).toBe(700)
  })
})
