import { describe, expect, it } from "vitest"

import type { WizardMasterData } from "@/lib/employee-wizard-mapper"
import { buildHireWizardData } from "@/lib/recruitment/hire-prefill"

const masterData: WizardMasterData = {
  departments: [
    { id: "d1", name: "Mühasibat" },
    { id: "d2", name: "Mühafizə" },
  ],
  positions: [
    { id: "p1", title: "Baş mühasib", departmentId: "d1" },
    { id: "p2", title: "Gözətçi", departmentId: "d2" },
  ],
  companies: [{ id: "c1", name: "Şirkət" }],
  branches: [{ id: "b1", name: "Baş Ofis", companyId: "c1" }],
  workSchedules: [],
  managers: [],
}

const candidate = { firstName: "Ali", lastName: "Əliyev", fatherName: "Vəli", phone: "050 111 22 33", email: "a@x.az", finCode: "ABC1234" }

describe("buildHireWizardData", () => {
  it("fills personal data, hire date, net salary, department, branch and company", () => {
    const data = buildHireWizardData(
      { candidate, requisition: { title: "Gözətçi", departmentId: "d2", branchId: "b1" }, offer: { salary: 850, startDate: "2026-12-01" } },
      masterData
    )
    expect(data).toMatchObject({
      firstName: "Ali",
      lastName: "Əliyev",
      fatherName: "Vəli",
      phone: "050 111 22 33",
      email: "a@x.az",
      finCode: "ABC1234",
      hireDate: "2026-12-01",
      baseSalary: 850,
      departmentId: "d2",
      positionId: "p2",
      branchId: "b1",
      companyId: "c1",
    })
  })

  it("matches the position by normalised title and only inside the vacancy's department", () => {
    const inSameDept = buildHireWizardData(
      { candidate, requisition: { title: "  GÖZƏTÇİ ", departmentId: "d2", branchId: null }, offer: null },
      masterData
    )
    expect(inSameDept.positionId).toBe("p2")

    const otherDept = buildHireWizardData(
      { candidate, requisition: { title: "Gözətçi", departmentId: "d1", branchId: null }, offer: null },
      masterData
    )
    expect(otherDept.positionId).toBe("")
  })

  it("leaves unresolved fields blank instead of guessing", () => {
    const data = buildHireWizardData(
      { candidate, requisition: { title: "Yeni vəzifə", departmentId: null, branchId: "missing" }, offer: null },
      masterData
    )
    expect(data).toMatchObject({ departmentId: "", positionId: "", branchId: "", companyId: "", hireDate: "", baseSalary: "" })
  })
})
