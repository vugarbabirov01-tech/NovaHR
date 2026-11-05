import { describe, expect, it } from "vitest"

import { ALL_PERMISSION_KEYS, PERMISSIONS, SELF_DERIVED_PERMISSION_KEYS } from "@/lib/auth/permissions"

describe("permission registry", () => {
  it("every entry's own key matches the object key it's stored under", () => {
    for (const key of ALL_PERMISSION_KEYS) {
      expect(PERMISSIONS[key].key).toBe(key)
    }
  })

  it("has no duplicate keys", () => {
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(ALL_PERMISSION_KEYS.length)
  })

  it("every self-derived permission is tagged dataLevel: self, and vice versa", () => {
    for (const key of SELF_DERIVED_PERMISSION_KEYS) {
      expect(PERMISSIONS[key].dataLevel).toBe("self")
    }
    const selfTagged = ALL_PERMISSION_KEYS.filter((key) => PERMISSIONS[key].dataLevel === "self")
    expect(new Set(selfTagged)).toEqual(new Set(SELF_DERIVED_PERMISSION_KEYS))
  })

  it("EMPLOYEE_SELF_VIEW and PAYROLL_SELF_VIEW are the two self-derived permissions, and are distinct", () => {
    expect(new Set(SELF_DERIVED_PERMISSION_KEYS)).toEqual(new Set(["EMPLOYEE_SELF_VIEW", "PAYROLL_SELF_VIEW"]))
  })

  it("every sensitive-data-level permission is documented as such", () => {
    const sensitive = ALL_PERMISSION_KEYS.filter((key) => PERMISSIONS[key].dataLevel === "sensitive")
    expect(sensitive).toContain("PAYROLL_VIEW_AMOUNTS")
    expect(sensitive).toContain("PAYROLL_EDIT")
    expect(sensitive).toContain("SETTINGS_MANAGE_USERS")
    expect(sensitive).toContain("AUDIT_LOG_VIEW")
  })
})
