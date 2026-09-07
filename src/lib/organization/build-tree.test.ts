import { describe, expect, it } from "vitest"

import { buildAncestorPathsById, buildOrganizationTree, flattenOrganizationTree } from "@/lib/organization/build-tree"
import type { EmployeeListItem } from "@/types/employee-profile"

function makeEmployee(overrides: Partial<EmployeeListItem> & Pick<EmployeeListItem, "id">): EmployeeListItem {
  return {
    id: overrides.id,
    employeeNumber: overrides.id,
    finCode: `FIN-${overrides.id}`,
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

/**
 * Manager A
 *  ├── Employee 1
 *  ├── Manager B
 *  │    ├── Employee 2
 *  │    └── Employee 3
 *  └── Employee 4
 * — the exact example from the Organization Chart spec: Manager A -> 5,
 * Manager B -> 2.
 */
const managerA = makeEmployee({ id: "A", firstName: "Manager", lastName: "A" })
const employee1 = makeEmployee({ id: "E1", firstName: "Employee", lastName: "1", managerId: "A" })
const managerB = makeEmployee({ id: "B", firstName: "Manager", lastName: "B", managerId: "A" })
const employee2 = makeEmployee({ id: "E2", firstName: "Employee", lastName: "2", managerId: "B" })
const employee3 = makeEmployee({ id: "E3", firstName: "Employee", lastName: "3", managerId: "B" })
const employee4 = makeEmployee({ id: "E4", firstName: "Employee", lastName: "4", managerId: "A" })

const sampleEmployees = [managerA, employee1, managerB, employee2, employee3, employee4]

describe("buildOrganizationTree", () => {
  it("attaches every employee under their real manager, not a hardcoded shape", () => {
    const tree = buildOrganizationTree(sampleEmployees)
    expect(tree).toHaveLength(1)
    expect(tree[0].employee.id).toBe("A")
    expect(tree[0].children.map((c) => c.employee.id).sort()).toEqual(["B", "E1", "E4"])
    const nodeB = tree[0].children.find((c) => c.employee.id === "B")!
    expect(nodeB.children.map((c) => c.employee.id).sort()).toEqual(["E2", "E3"])
  })

  it("computes the recursive descendant count exactly as specified (Manager A -> 5, Manager B -> 2)", () => {
    const tree = buildOrganizationTree(sampleEmployees)
    expect(tree[0].descendantCount).toBe(5)
    const nodeB = tree[0].children.find((c) => c.employee.id === "B")!
    expect(nodeB.descendantCount).toBe(2)
    const nodeE1 = tree[0].children.find((c) => c.employee.id === "E1")!
    expect(nodeE1.descendantCount).toBe(0)
  })

  it("treats an employee with no managerId as a root", () => {
    const solo = makeEmployee({ id: "SOLO" })
    const tree = buildOrganizationTree([solo])
    expect(tree).toHaveLength(1)
    expect(tree[0].employee.id).toBe("SOLO")
  })

  it("treats an employee whose managerId isn't in the given list as a root, rather than dropping them", () => {
    const orphan = makeEmployee({ id: "ORPHAN", managerId: "DOES-NOT-EXIST" })
    const tree = buildOrganizationTree([orphan])
    expect(tree).toHaveLength(1)
    expect(tree[0].employee.id).toBe("ORPHAN")
  })

  it("never infinite-loops on a managerId cycle", () => {
    const cycleA = makeEmployee({ id: "CYCLE-A", managerId: "CYCLE-B" })
    const cycleB = makeEmployee({ id: "CYCLE-B", managerId: "CYCLE-A" })
    expect(() => buildOrganizationTree([cycleA, cycleB])).not.toThrow()
  })

  it("supports multiple root managers, each with their own independent subtree", () => {
    const rootX = makeEmployee({ id: "X", firstName: "Root", lastName: "X" })
    const rootY = makeEmployee({ id: "Y", firstName: "Root", lastName: "Y" })
    const underX = makeEmployee({ id: "UX", managerId: "X" })
    const tree = buildOrganizationTree([rootX, rootY, underX])
    expect(tree).toHaveLength(2)
    expect(tree.find((n) => n.employee.id === "X")!.descendantCount).toBe(1)
    expect(tree.find((n) => n.employee.id === "Y")!.descendantCount).toBe(0)
  })
})

describe("flattenOrganizationTree", () => {
  it("visits every node exactly once, regardless of depth", () => {
    const tree = buildOrganizationTree(sampleEmployees)
    const flat = flattenOrganizationTree(tree)
    expect(flat.map((n) => n.employee.id).sort()).toEqual(["A", "B", "E1", "E2", "E3", "E4"])
  })
})

describe("buildAncestorPathsById", () => {
  it("gives the exact root-to-parent chain for a deeply nested employee", () => {
    const tree = buildOrganizationTree(sampleEmployees)
    const paths = buildAncestorPathsById(tree)
    expect(paths.get("E2")).toEqual(["A", "B"])
    expect(paths.get("A")).toEqual([])
    expect(paths.get("E1")).toEqual(["A"])
  })
})
