import { describe, expect, it } from "vitest"

import { buildReplacementRequisition } from "@/lib/recruitment/replacement-vacancy"
import type { EmployeeProfile } from "@/types/employee-profile"

function employee(overrides: Partial<EmployeeProfile["employment"]> = {}): EmployeeProfile {
  return {
    personal: { firstName: "Ali", lastName: "Əliyev", fatherName: "Vəli" },
    employment: {
      employeeNumber: "EMP-001",
      department: "Mühafizə",
      position: "Gözətçi",
      branchId: "b1",
      history: [
        { id: "h1", date: "2020-01-01", type: "hire", title: "Hired", description: "" },
        { id: "h2", date: "2026-11-01", type: "termination", title: "Employment terminated", description: "" },
      ],
      ...overrides,
    },
  } as unknown as EmployeeProfile
}

const departments = [
  { id: "d1", name: "Mühasibat" },
  { id: "d2", name: "Mühafizə" },
]

describe("buildReplacementRequisition", () => {
  it("opens one replacement opening for the same position, department and branch", () => {
    const input = buildReplacementRequisition(employee(), departments)
    expect(input).toMatchObject({
      title: "Gözətçi",
      departmentId: "d2",
      branchId: "b1",
      openings: 1,
      reason: "REPLACEMENT",
    })
  })

  it("names who left and when, in the description", () => {
    const input = buildReplacementRequisition(employee(), departments)
    expect(input.description).toContain("Əliyev")
    expect(input.description).toContain("EMP-001")
    expect(input.description).toContain("2026-11-01")
  })

  it("matches the department by normalised name and leaves it empty when it no longer exists", () => {
    expect(buildReplacementRequisition(employee({ department: "  MÜHAFİZƏ " }), departments).departmentId).toBe("d2")
    expect(buildReplacementRequisition(employee({ department: "Silinmiş şöbə" }), departments).departmentId).toBeNull()
  })

  it("leaves the branch empty when the employee has none", () => {
    expect(buildReplacementRequisition(employee({ branchId: undefined }), departments).branchId).toBeNull()
  })
})
