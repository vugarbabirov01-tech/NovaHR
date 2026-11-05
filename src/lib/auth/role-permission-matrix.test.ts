import { describe, expect, it } from "vitest"

import { PERMISSIONS, SELF_DERIVED_PERMISSION_KEYS } from "@/lib/auth/permissions"
import { ROLE_DEFINITIONS, ROLE_PERMISSIONS } from "@/lib/auth/role-permission-matrix"

describe("role-permission matrix", () => {
  it("every role listed in ROLE_PERMISSIONS has a matching ROLE_DEFINITIONS entry, and vice versa", () => {
    expect(new Set(Object.keys(ROLE_PERMISSIONS))).toEqual(new Set(Object.keys(ROLE_DEFINITIONS)))
  })

  it("every permission key referenced by any role is a real, known permission", () => {
    for (const roleKey of Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[]) {
      for (const permissionKey of ROLE_PERMISSIONS[roleKey]) {
        expect(PERMISSIONS[permissionKey]).toBeDefined()
      }
    }
  })

  it("no ordinary role is ever granted a self-derived permission through the matrix — those are identity-derived, never role-assigned (SUPER_ADMIN is the one deliberate exception, see its own test below)", () => {
    const ordinaryRoles = (Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[]).filter(
      (roleKey) => roleKey !== "SUPER_ADMIN"
    )
    for (const roleKey of ordinaryRoles) {
      for (const selfKey of SELF_DERIVED_PERMISSION_KEYS) {
        expect(ROLE_PERMISSIONS[roleKey]).not.toContain(selfKey)
      }
    }
  })

  it("SUPER_ADMIN has every permission, including the self-derived ones (it bypasses the distinction by design)", () => {
    const allKeys = Object.keys(PERMISSIONS)
    expect(new Set(ROLE_PERMISSIONS.SUPER_ADMIN)).toEqual(new Set(allKeys))
  })

  it("AUDITOR has no mutating permission anywhere (strictly read-only)", () => {
    for (const permissionKey of ROLE_PERMISSIONS.AUDITOR) {
      expect(PERMISSIONS[permissionKey].action).not.toBe("EDIT")
      expect(PERMISSIONS[permissionKey].action).not.toBe("CREATE")
      expect(PERMISSIONS[permissionKey].action).not.toBe("DELETE")
      expect(PERMISSIONS[permissionKey].action).not.toBe("MANAGE")
    }
  })

  it("COMPANY_MANAGER and BRANCH_MANAGER have no mutating permission anywhere (read-mostly oversight, by default)", () => {
    for (const roleKey of ["COMPANY_MANAGER", "BRANCH_MANAGER"] as const) {
      for (const permissionKey of ROLE_PERMISSIONS[roleKey]) {
        expect(["VIEW"]).toContain(PERMISSIONS[permissionKey].action)
      }
    }
  })

  it("only SUPER_ADMIN and PAYROLL_SPECIALIST can see payroll amounts by default", () => {
    const rolesWithAmounts = Object.entries(ROLE_PERMISSIONS)
      .filter(([, perms]) => perms.includes("PAYROLL_VIEW_AMOUNTS"))
      .map(([roleKey]) => roleKey)
    expect(new Set(rolesWithAmounts)).toEqual(new Set(["SUPER_ADMIN", "PAYROLL_SPECIALIST"]))
  })
})
