import { describe, expect, it } from "vitest"

import { buildOrganizationTree } from "@/lib/organization/build-tree"
import {
  computeOrganizationChartVisibility,
  defaultOrganizationChartFilters,
} from "@/lib/organization/filter-tree"
import { ALL_VALUE } from "@/types/employee-filters"
import type { EmployeeListItem } from "@/types/employee-profile"

function makeEmployee(overrides: Partial<EmployeeListItem> & Pick<EmployeeListItem, "id">): EmployeeListItem {
  return {
    id: overrides.id,
    employeeNumber: overrides.id,
    finCode: overrides.finCode ?? `FIN-${overrides.id}`,
    firstName: overrides.firstName ?? "First",
    lastName: overrides.lastName ?? overrides.id,
    dateOfBirth: "1990-01-01",
    email: `${overrides.id}@example.com`,
    phone: "+994000000000",
    company: "Nova Group LLC",
    department: overrides.department ?? "Engineering",
    position: overrides.position ?? "Engineer",
    branch: "Baku HQ",
    workLocation: "Baku HQ",
    managerId: overrides.managerId,
    managerName: overrides.managerName,
    employmentType: "full-time",
    employmentStatus: overrides.employmentStatus ?? "active",
    hireDate: "2020-01-01",
    baseSalary: 1000,
    currency: "AZN",
  }
}

// CEO -> Director -> Manager -> Employee, matching the spec's own
// auto-expand example exactly.
const ceo = makeEmployee({ id: "CEO", firstName: "Ceo", lastName: "Person" })
const director = makeEmployee({ id: "DIR", firstName: "Director", lastName: "Person", managerId: "CEO" })
const manager = makeEmployee({
  id: "MGR",
  firstName: "Manager",
  lastName: "Person",
  managerId: "DIR",
  managerName: "Director Person",
  department: "Design",
})
const employee = makeEmployee({
  id: "EMP",
  firstName: "Aysel",
  lastName: "Quliyeva",
  finCode: "0DE2F4G",
  managerId: "MGR",
  managerName: "Manager Person",
  department: "Design",
  position: "Marketing Specialist",
})
const unrelated = makeEmployee({ id: "OTHER", managerId: "CEO", department: "Sales" })

const tree = buildOrganizationTree([ceo, director, manager, employee, unrelated])

describe("computeOrganizationChartVisibility", () => {
  it("returns null visibleIds when nothing is searched/filtered (normal expand rules apply)", () => {
    const result = computeOrganizationChartVisibility(tree, "", defaultOrganizationChartFilters)
    expect(result.visibleIds).toBeNull()
    expect(result.matchedIds.size).toBe(0)
  })

  it("finds a deeply nested employee by name and force-expands every ancestor down to them", () => {
    const result = computeOrganizationChartVisibility(tree, "Aysel", defaultOrganizationChartFilters)
    expect(result.matchedIds.has("EMP")).toBe(true)
    expect(result.forceExpandIds).toEqual(new Set(["CEO", "DIR", "MGR"]))
    expect(result.visibleIds).toEqual(new Set(["CEO", "DIR", "MGR", "EMP"]))
    // The unrelated branch (OTHER, a direct CEO report) is pruned — it
    // isn't a match and isn't an ancestor of one.
    expect(result.visibleIds?.has("OTHER")).toBe(false)
  })

  it("matches by FIN code", () => {
    const result = computeOrganizationChartVisibility(tree, "0DE2F4G", defaultOrganizationChartFilters)
    expect(result.matchedIds.has("EMP")).toBe(true)
  })

  it("matches by position and department", () => {
    expect(
      computeOrganizationChartVisibility(tree, "marketing specialist", defaultOrganizationChartFilters).matchedIds.has(
        "EMP"
      )
    ).toBe(true)
    expect(
      computeOrganizationChartVisibility(tree, "design", defaultOrganizationChartFilters).matchedIds.has("MGR")
    ).toBe(true)
  })

  it("is case-insensitive", () => {
    const result = computeOrganizationChartVisibility(tree, "AYSEL", defaultOrganizationChartFilters)
    expect(result.matchedIds.has("EMP")).toBe(true)
  })

  it("a department filter keeps the matching employee's parent managers visible for context", () => {
    const result = computeOrganizationChartVisibility(tree, "", {
      ...defaultOrganizationChartFilters,
      department: "Design",
    })
    expect(result.matchedIds).toEqual(new Set(["MGR", "EMP"]))
    expect(result.visibleIds).toEqual(new Set(["CEO", "DIR", "MGR", "EMP"]))
  })

  it("combining a filter and a search query narrows to their intersection", () => {
    const result = computeOrganizationChartVisibility(tree, "Aysel", {
      ...defaultOrganizationChartFilters,
      department: "Sales",
    })
    expect(result.matchedIds.size).toBe(0)
    expect(result.visibleIds?.size).toBe(0)
  })
})

describe("defaultOrganizationChartFilters", () => {
  it("starts with every filter set to ALL_VALUE", () => {
    expect(Object.values(defaultOrganizationChartFilters).every((v) => v === ALL_VALUE)).toBe(true)
  })
})
