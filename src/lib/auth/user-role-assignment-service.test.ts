import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createAuthTestSandbox, type AuthSandbox } from "@/lib/auth/test-sandbox-db"
import { ROLE_DEFINITIONS, ROLE_PERMISSIONS, type RoleKey } from "@/lib/auth/role-permission-matrix"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { createUser } from "@/repositories/user-repository"
import { upsertRole } from "@/repositories/role-repository"
import { upsertPermission, grantPermissionToRole } from "@/repositories/permission-repository"
import { findRoleByKey } from "@/repositories/role-repository"
import { findPermissionByKey } from "@/repositories/permission-repository"
import {
  createUserRoleAssignmentForRole,
  findActiveAssignments,
  revokeUserRoleAssignment,
  InvalidScopeError,
  RoleScopeViolationError,
  UnknownRoleError,
} from "@/lib/auth/user-role-assignment-service"

/**
 * Runs entirely against a disposable, schema-only sandbox (see
 * test-sandbox-db.ts) — UserRoleAssignment.activeKey only exists once its
 * own migration (proposed, not yet applied — see the Phase A follow-up
 * report) lands on the real dev.db, so this cannot run against the real
 * shared database the rest of this project's tests use. Nothing here
 * touches real employee/company/branch rows except via plain reads (a
 * real, existing Company id is used read-only for the "valid scope"
 * cases, a real, existing ARCHIVED Company id for the "inactive scope
 * rejected" case — never written to).
 */
describe("user-role-assignment-service", () => {
  let sandbox: AuthSandbox
  let userA: string
  let userB: string

  // Real, existing rows in dev.db — read-only, never written to by this
  // suite. "Bakı Abadlıq Xidməti" is active; "Nova Group LLC" is archived
  // (active: false) — both confirmed via a direct read before writing
  // this suite.
  const REAL_ACTIVE_COMPANY_ID = "cmtr5laqr0000s4u15k1dafda"
  const REAL_INACTIVE_COMPANY_ID = "cms5oyhxq0000tou1efnz50pt"
  const REAL_ACTIVE_BRANCH_ID = "cmtr5lar30002s4u14fto2cbw"
  const NONEXISTENT_ID = "does-not-exist-id"

  beforeAll(async () => {
    sandbox = createAuthTestSandbox()
    const { client } = sandbox

    for (const roleKey of Object.keys(ROLE_DEFINITIONS) as RoleKey[]) {
      const def = ROLE_DEFINITIONS[roleKey]
      await upsertRole({ key: roleKey, name: def.name, description: def.description }, client)
    }
    for (const permissionKey of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
      await upsertPermission({ key: permissionKey, description: PERMISSIONS[permissionKey].description }, client)
    }
    for (const roleKey of Object.keys(ROLE_PERMISSIONS) as RoleKey[]) {
      const role = await findRoleByKey(roleKey, client)
      for (const permissionKey of ROLE_PERMISSIONS[roleKey]) {
        const permission = await findPermissionByKey(permissionKey, client)
        await grantPermissionToRole(role!.id, permission!.id, client)
      }
    }

    const a = await createUser({ email: "sandbox-user-a@test.local", passwordHash: "x", fullName: "Sandbox User A" }, client)
    const b = await createUser({ email: "sandbox-user-b@test.local", passwordHash: "x", fullName: "Sandbox User B" }, client)
    userA = a.id
    userB = b.id
  })

  afterAll(async () => {
    await sandbox.cleanup()
  })

  it("rejects GLOBAL scope with a non-null scopeId", async () => {
    await expect(
      createUserRoleAssignmentForRole(
        { userId: userA, roleKey: "HR_SPECIALIST", scopeType: "GLOBAL", scopeId: REAL_ACTIVE_COMPANY_ID, assignedBy: "test" },
        sandbox.client
      )
    ).rejects.toBeInstanceOf(InvalidScopeError)
  })

  it("rejects COMPANY scope with a null scopeId", async () => {
    await expect(
      createUserRoleAssignmentForRole(
        { userId: userA, roleKey: "HR_SPECIALIST", scopeType: "COMPANY", scopeId: null, assignedBy: "test" },
        sandbox.client
      )
    ).rejects.toBeInstanceOf(InvalidScopeError)
  })

  it("rejects COMPANY scope naming a company that does not exist", async () => {
    await expect(
      createUserRoleAssignmentForRole(
        { userId: userA, roleKey: "HR_SPECIALIST", scopeType: "COMPANY", scopeId: NONEXISTENT_ID, assignedBy: "test" },
        sandbox.client
      )
    ).rejects.toBeInstanceOf(InvalidScopeError)
  })

  it("rejects COMPANY scope naming a real but archived (inactive) company", async () => {
    await expect(
      createUserRoleAssignmentForRole(
        { userId: userA, roleKey: "HR_SPECIALIST", scopeType: "COMPANY", scopeId: REAL_INACTIVE_COMPANY_ID, assignedBy: "test" },
        sandbox.client
      )
    ).rejects.toBeInstanceOf(InvalidScopeError)
  })

  it("accepts COMPANY scope naming a real, active company", async () => {
    const result = await createUserRoleAssignmentForRole(
      { userId: userA, roleKey: "COMPANY_MANAGER", scopeType: "COMPANY", scopeId: REAL_ACTIVE_COMPANY_ID, assignedBy: "test" },
      sandbox.client
    )
    expect(result.scopeType).toBe("COMPANY")
    expect(result.scopeId).toBe(REAL_ACTIVE_COMPANY_ID)
    await revokeUserRoleAssignment(result.id, "test", sandbox.client)
  })

  it("accepts BRANCH scope naming a real, active branch", async () => {
    const result = await createUserRoleAssignmentForRole(
      { userId: userA, roleKey: "BRANCH_MANAGER", scopeType: "BRANCH", scopeId: REAL_ACTIVE_BRANCH_ID, assignedBy: "test" },
      sandbox.client
    )
    expect(result.scopeId).toBe(REAL_ACTIVE_BRANCH_ID)
    await revokeUserRoleAssignment(result.id, "test", sandbox.client)
  })

  it("rejects SUPER_ADMIN assigned with COMPANY scope", async () => {
    await expect(
      createUserRoleAssignmentForRole(
        { userId: userA, roleKey: "SUPER_ADMIN", scopeType: "COMPANY", scopeId: REAL_ACTIVE_COMPANY_ID, assignedBy: "test" },
        sandbox.client
      )
    ).rejects.toBeInstanceOf(RoleScopeViolationError)
  })

  it("accepts SUPER_ADMIN assigned with GLOBAL scope", async () => {
    const result = await createUserRoleAssignmentForRole(
      { userId: userA, roleKey: "SUPER_ADMIN", scopeType: "GLOBAL", scopeId: null, assignedBy: "test" },
      sandbox.client
    )
    expect(result.scopeType).toBe("GLOBAL")
    expect(result.scopeId).toBeNull()
    await revokeUserRoleAssignment(result.id, "test", sandbox.client)
  })

  it("throws UnknownRoleError for a role key that was never seeded", async () => {
    await expect(
      createUserRoleAssignmentForRole(
        { userId: userA, roleKey: "NOT_A_REAL_ROLE" as RoleKey, scopeType: "GLOBAL", scopeId: null, assignedBy: "test" },
        sandbox.client
      )
    ).rejects.toBeInstanceOf(UnknownRoleError)
  })

  it("blocks a sequential duplicate — the second call returns the SAME row, not a new one", async () => {
    const first = await createUserRoleAssignmentForRole(
      { userId: userB, roleKey: "HR_SPECIALIST", scopeType: "GLOBAL", scopeId: null, assignedBy: "test" },
      sandbox.client
    )
    const second = await createUserRoleAssignmentForRole(
      { userId: userB, roleKey: "HR_SPECIALIST", scopeType: "GLOBAL", scopeId: null, assignedBy: "test" },
      sandbox.client
    )
    expect(second.id).toBe(first.id)

    const active = await findActiveAssignments(userB, sandbox.client)
    expect(active.filter((a) => a.roleId === first.roleId)).toHaveLength(1)

    await revokeUserRoleAssignment(first.id, "test", sandbox.client)
  })

  it("closes the concurrent-duplicate race: 5 parallel creates for the same (user, role, scope) resolve to exactly one row", async () => {
    const role = await findRoleByKey("AUDITOR", sandbox.client)
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        createUserRoleAssignmentForRole(
          { userId: userB, roleKey: "AUDITOR", scopeType: "GLOBAL", scopeId: null, assignedBy: "test" },
          sandbox.client
        )
      )
    )
    const uniqueIds = new Set(attempts.map((a) => a.id))
    expect(uniqueIds.size).toBe(1)

    const rows = await sandbox.client.userRoleAssignment.findMany({
      where: { userId: userB, roleId: role!.id, revokedAt: null },
    })
    expect(rows).toHaveLength(1)

    await revokeUserRoleAssignment(attempts[0].id, "test", sandbox.client)
  })

  it("revoking sets revokedAt, nulls activeKey, and excludes the row from findActiveAssignments", async () => {
    const created = await createUserRoleAssignmentForRole(
      { userId: userB, roleKey: "HR_ADMIN", scopeType: "GLOBAL", scopeId: null, assignedBy: "test" },
      sandbox.client
    )
    const revoked = await revokeUserRoleAssignment(created.id, "reviewer", sandbox.client)
    expect(revoked.revokedAt).not.toBeNull()
    expect(revoked.activeKey).toBeNull()

    const active = await findActiveAssignments(userB, sandbox.client)
    expect(active.some((a) => a.id === created.id)).toBe(false)
  })

  it("allows re-granting the same (user, role, scope) after the prior one was revoked", async () => {
    const first = await createUserRoleAssignmentForRole(
      { userId: userA, roleKey: "PAYROLL_SPECIALIST", scopeType: "GLOBAL", scopeId: null, assignedBy: "test" },
      sandbox.client
    )
    await revokeUserRoleAssignment(first.id, "test", sandbox.client)

    const second = await createUserRoleAssignmentForRole(
      { userId: userA, roleKey: "PAYROLL_SPECIALIST", scopeType: "GLOBAL", scopeId: null, assignedBy: "test" },
      sandbox.client
    )
    expect(second.id).not.toBe(first.id)
    expect(second.revokedAt).toBeNull()

    await revokeUserRoleAssignment(second.id, "test", sandbox.client)
  })

  it("writes an AuthAuditLogEntry on assign and on revoke", async () => {
    const created = await createUserRoleAssignmentForRole(
      { userId: userA, roleKey: "AUDITOR", scopeType: "GLOBAL", scopeId: null, assignedBy: "audit-test-actor" },
      sandbox.client
    )
    const assignEntries = await sandbox.client.authAuditLogEntry.findMany({
      where: { action: "user_role_assignment.assigned", targetId: created.id },
    })
    expect(assignEntries).toHaveLength(1)
    expect(assignEntries[0].actorUserId).toBe("audit-test-actor")

    await revokeUserRoleAssignment(created.id, "revoke-test-actor", sandbox.client)
    const revokeEntries = await sandbox.client.authAuditLogEntry.findMany({
      where: { action: "user_role_assignment.revoked", targetId: created.id },
    })
    expect(revokeEntries).toHaveLength(1)
    expect(revokeEntries[0].actorUserId).toBe("revoke-test-actor")
  })
})
