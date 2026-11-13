import { describe, expect, it } from "vitest"

import { buildNewProfile, computeSync, COL, DETAIL_COL, type EmasRow } from "@/lib/emas-sync/compute-sync"
import {
  parseDisability,
  parseEmasDate,
  parseExperience,
  parseLeave,
  splitFullName,
} from "@/lib/emas-sync/parse"
import { resolveAnnualLeaveEntitlement } from "@/lib/leave/leave-policy-resolution-service"
import { applyEditableFields, extractEditableFields } from "@/lib/employee-edit-diff"
import type { EmployeeProfile } from "@/types/employee-profile"

describe("parsers", () => {
  it("parses dd.mm.yyyy and rejects impossible dates", () => {
    expect(parseEmasDate("02.06.2014")).toBe("2014-06-02")
    expect(parseEmasDate("31.02.2014")).toBeUndefined()
    expect(parseEmasDate("Məlumat yoxdur")).toBeUndefined()
  })
  it("parses experience, leave and disability groups", () => {
    expect(parseExperience("6 il, 8 ay, 23 gün")).toEqual({ years: 6, months: 8, days: 23 })
    expect(parseLeave("23 gün (əsas 21 + staja görə 2)")).toEqual({ base: 21, seniority: 2 })
    expect(parseLeave("21 gün (əsas 21)")).toEqual({ base: 21, seniority: 0 })
    expect(parseLeave("Məlumat yoxdur")).toBeUndefined()
    expect(parseDisability("Orqanizmin funksiyalarının 31-60 faiz pozulması (səbəb: Ümumi xəstəlik)")).toEqual({
      group: "III",
      cause: "Ümumi xəstəlik",
    })
    expect(parseDisability("Orqanizmin funksiyalarının 61-80 faiz pozulması (səbəb: X)")?.group).toBe("II")
    expect(parseDisability("Orqanizmin funksiyalarının 81-100 faiz pozulması (səbəb: X)")?.group).toBe("I")
  })
  it("splits names and derives gender", () => {
    expect(splitFullName("MURAD HEYDƏROV POLAD OĞLU")).toEqual({
      firstName: "Murad",
      lastName: "Heydərov",
      fatherName: "Polad",
      gender: "male",
    })
    expect(splitFullName("AYNUR İSMAYILOVA RƏŞAD QIZI")?.gender).toBe("female")
    expect(splitFullName("İXTİYAR QULİYEV")).toBeUndefined()
  })
})

function baseProfile(): EmployeeProfile {
  return buildNewProfile(row(), [], "EMP-000900")!.profile
}

function row(overrides: Partial<EmasRow> = {}): EmasRow {
  return {
    [COL.fullName]: "MURAD HEYDƏROV POLAD OĞLU",
    [COL.fin]: "7C4NMC6",
    [COL.hireDate]: "03.11.2026",
    [COL.experience]: "4 il, 0 ay, 23 gün",
    [COL.nationalId]: "AB0944616",
    [COL.idIssueDate]: "24.07.2026",
    [COL.idIssuedBy]: "Asan 6",
    [COL.dob]: "18.09.1999",
    [COL.actualAddress]: "Məlumat yoxdur",
    [COL.registrationAddress]: "BAKI ŞƏHƏRİ, XƏTAİ RAYONU",
    [COL.phone]: "+994709540600",
    [COL.ssn]: "1809199900996",
    [COL.disability]: "Məlumat yoxdur",
    [COL.gross]: 805,
    [COL.position]: "Fəhlə",
    [COL.veteran]: "Məlumat yoxdur",
    [COL.martyr]: "Məlumat yoxdur",
    [COL.leave]: "21 gün (əsas 21)",
    ...overrides,
  }
}

describe("computeSync", () => {
  it("never touches net salary, keeps a filled phone and the Nova address", () => {
    const existing = baseProfile()
    existing.payroll.baseSalary = 700
    existing.personal.phone = "+994 55 111 22 33"
    existing.personal.address = "Nova ünvanı"
    const { profile } = computeSync(
      existing,
      row({ [COL.actualAddress]: "ƏMAS faktiki", [COL.phone]: "+994700000000" }),
      []
    )
    expect(profile.payroll.baseSalary).toBe(700)
    expect(profile.personal.phone).toBe("+994 55 111 22 33")
    expect(profile.personal.address).toBe("Nova ünvanı")
  })

  it("fills the empty phone, overwrites position/hire date and writes audit entries", () => {
    const existing = baseProfile()
    existing.personal.phone = ""
    existing.employment.position = "Köhnə"
    existing.employment.hireDate = "2014-03-01"
    existing.employment.history = [{ id: "h", date: "2014-03-01", type: "hire", title: "t", description: "d" }]
    const { profile, changes } = computeSync(existing, row({ [COL.hireDate]: "02.06.2014" }), [])
    expect(profile.personal.phone).toBe("+994709540600")
    expect(profile.employment.position).toBe("Fəhlə")
    expect(profile.employment.hireDate).toBe("2014-06-02")
    expect(profile.employment.history[0].date).toBe("2014-06-02")
    const fields = changes.map((c) => c.field)
    expect(fields).toContain("employment.hireDate")
    expect(profile.auditLog.filter((a) => a.action === "emas.sync")).toHaveLength(changes.length)
  })

  it("is idempotent: a second run reports no changes", () => {
    const first = computeSync(baseProfile(), row({ [COL.disability]: "Orqanizmin funksiyalarının 31-60 faiz pozulması (səbəb: Ümumi xəstəlik)" }), [])
    const second = computeSync(first.profile, row({ [COL.disability]: "Orqanizmin funksiyalarının 31-60 faiz pozulması (səbəb: Ümumi xəstəlik)" }), [])
    expect(second.changes).toEqual([])
  })

  it("carries an ƏMAS base of 30 via annualBaseLeaveDays and adds Nova's own seniority (30 + 2)", () => {
    const { profile, leaveComparison } = computeSync(
      baseProfile(),
      row({ [COL.leave]: "30 gün (əsas 30)", [COL.experience]: "6 il, 0 ay, 0 gün" }),
      []
    )
    expect(profile.labourLaw.annualBaseLeaveDays).toBe(30)
    expect(profile.labourLaw.companyAdditionalLeaveDays).toBe(0)
    expect(resolveAnnualLeaveEntitlement(profile).totalDays).toBe(32)
    expect(profile.leave.annualLeaveEntitlement).toBe(30)
    expect(profile.leave.additionalLeaveEntitlement).toBe(2)
    expect(leaveComparison).toEqual({ emasTotal: 30, novaTotal: 32 })
  })

  it("leaves the base override unset for a base of 21", () => {
    const { profile } = computeSync(baseProfile(), row({ [COL.leave]: "21 gün (əsas 21)" }), [])
    expect(profile.labourLaw.annualBaseLeaveDays).toBeUndefined()
    expect(profile.leave.annualLeaveEntitlement).toBe(21)
  })

  it("does not stack the company base on top of a disability base", () => {
    const { profile } = computeSync(
      baseProfile(),
      row({
        [COL.leave]: "30 gün (əsas 30)",
        [COL.disability]: "Orqanizmin funksiyalarının 31-60 faiz pozulması (səbəb: Ümumi xəstəlik)",
      }),
      []
    )
    expect(profile.labourLaw.annualBaseLeaveDays).toBeUndefined()
    expect(resolveAnnualLeaveEntitlement(profile).totalDays).toBe(42)
  })

  it("is idempotent for the leave fields", () => {
    const r = row({ [COL.leave]: "30 gün (əsas 30)", [COL.experience]: "6 il, 0 ay, 0 gün" })
    const first = computeSync(baseProfile(), r, [])
    expect(computeSync(first.profile, r, []).changes).toEqual([])
  })

  it("builds previous employments, skipping the own company and undated rows", () => {
    const d = (over: Record<string, string>) => ({
      [DETAIL_COL.fin]: "7C4NMC6",
      [DETAIL_COL.organization]: "ACME",
      [DETAIL_COL.taxId]: "111",
      [DETAIL_COL.position]: "İşçi",
      [DETAIL_COL.start]: "01.01.2020",
      [DETAIL_COL.end]: "01.02.2020",
      [DETAIL_COL.counted]: "Bəli",
      [DETAIL_COL.note]: "",
      ...over,
    })
    const { profile } = computeSync(
      baseProfile(),
      row(),
      [d({}), d({ [DETAIL_COL.taxId]: "1301709881" }), d({ [DETAIL_COL.start]: "—" }), d({ [DETAIL_COL.counted]: "Xeyr", [DETAIL_COL.note]: "Əvəzçilik (əlavə iş yeri)" })]
    )
    expect(profile.labourLaw.previousEmployments).toHaveLength(2)
    expect(profile.labourLaw.previousEmployments?.map((j) => j.counted)).toEqual([true, false])
  })
})

describe("applyEditableFields", () => {
  it("keeps ƏMAS-only fields that the edit wizard does not own", () => {
    const profile = baseProfile()
    profile.personal.socialInsuranceNumber = "123"
    profile.personal.registrationAddress = "Reg"
    profile.labourLaw.isMartyrFamilyMember = true
    profile.payroll.grossSalary = 805
    // Simulates the wizard draft: it only knows the editable fields.
    const draftPersonal = { ...profile.personal } as Record<string, unknown>
    delete draftPersonal.socialInsuranceNumber
    delete draftPersonal.registrationAddress
    const draftLabour = { ...profile.labourLaw } as Record<string, unknown>
    delete draftLabour.isMartyrFamilyMember
    const draft = { ...profile, personal: draftPersonal, labourLaw: draftLabour } as unknown as EmployeeProfile
    const next = applyEditableFields(profile, extractEditableFields(draft))
    expect(next.personal.socialInsuranceNumber).toBe("123")
    expect(next.personal.registrationAddress).toBe("Reg")
    expect(next.labourLaw.isMartyrFamilyMember).toBe(true)
    expect(next.payroll.grossSalary).toBe(805)
  })
})
