// Authentication Phase A — Role/Permission seed script. Prepared, NOT
// executed (see the Phase A follow-up report) — running this writes
// catalog rows (Role, Permission, RolePermission) into the REAL dev.db,
// which still needs its own explicit go-ahead even though none of this
// is employee data or a user account. Never creates a User, UserSession,
// or UserRoleAssignment — those are a different, separately-gated step
// (see scripts/bootstrap-super-admin.ts for the one path that creates a
// User, and it never calls this file).
//
// Run with: npx tsx prisma/seed-auth.ts
// First run (or after adding a permission to a role in the matrix) needs:
//   npx tsx prisma/seed-auth.ts --confirm-widening
//
// Idempotent by key for Role/Permission themselves (upsertRole/
// upsertPermission — safe to re-run any number of times with zero
// behavioral difference). RolePermission grants are handled more
// carefully: this script NEVER revokes a permission a role currently
// has but role-permission-matrix.ts no longer lists (narrowing an
// existing grant is a deliberate decision for whoever edits the matrix,
// never a silent side effect of re-seeding) — covered already.
//
// The NEW protection (2026-11-05): granting a permission a role does NOT
// YET have — i.e. the matrix was edited to WIDEN some role — now requires
// --confirm-widening. Without it, this script computes the diff, PRINTS
// exactly what would be newly granted to which role, and skips applying
// any of it; already-granted permissions are still safely re-affirmed
// (a true no-op) either way. This means an unreviewed edit to the matrix
// can never silently take effect just because someone ran the routine
// seed command — widening a real role's real permissions always leaves
// an explicit, visible trail at the moment it's applied.

import { prisma } from "@/lib/prisma"
import { upsertRole, findRoleByKey } from "@/repositories/role-repository"
import { upsertPermission, findPermissionByKey, grantPermissionToRole, findPermissionsForRole } from "@/repositories/permission-repository"
import { PERMISSIONS, ALL_PERMISSION_KEYS } from "@/lib/auth/permissions"
import { ROLE_DEFINITIONS, ROLE_PERMISSIONS, type RoleKey } from "@/lib/auth/role-permission-matrix"

async function seedPermissions() {
  for (const key of ALL_PERMISSION_KEYS) {
    const definition = PERMISSIONS[key]
    await upsertPermission({ key: key as never, description: definition.description })
  }
}

async function seedRoles() {
  for (const roleKey of Object.keys(ROLE_DEFINITIONS) as RoleKey[]) {
    const definition = ROLE_DEFINITIONS[roleKey]
    await upsertRole({ key: roleKey, name: definition.name, description: definition.description })
  }
}

interface SeedRolePermissionsResult {
  /** roleKey -> permission keys that WOULD be newly granted. Always
   * computed, regardless of confirmWidening, so the caller can print it. */
  pendingWidenings: Record<string, string[]>
  applied: boolean
}

async function seedRolePermissions(confirmWidening: boolean): Promise<SeedRolePermissionsResult> {
  const pendingWidenings: Record<string, string[]> = {}

  for (const roleKey of Object.keys(ROLE_PERMISSIONS) as RoleKey[]) {
    const role = await findRoleByKey(roleKey)
    if (!role) throw new Error(`seedRolePermissions: role "${roleKey}" was not created — seedRoles must run first.`)

    const currentGrants = await findPermissionsForRole(role.id)
    const currentKeys = new Set(currentGrants.map((grant) => grant.permission.key))
    const desiredKeys = ROLE_PERMISSIONS[roleKey]
    const newKeys = desiredKeys.filter((key) => !currentKeys.has(key))

    if (newKeys.length > 0) pendingWidenings[roleKey] = newKeys

    for (const permissionKey of desiredKeys) {
      const isNewGrant = !currentKeys.has(permissionKey)
      if (isNewGrant && !confirmWidening) continue // skip — needs --confirm-widening

      const permission = await findPermissionByKey(permissionKey)
      if (!permission) {
        throw new Error(`seedRolePermissions: permission "${permissionKey}" was not created — seedPermissions must run first.`)
      }
      await grantPermissionToRole(role.id, permission.id)
    }
  }

  return { pendingWidenings, applied: confirmWidening }
}

async function main() {
  const confirmWidening = process.argv.includes("--confirm-widening")

  await seedPermissions()
  await seedRoles()
  const { pendingWidenings, applied } = await seedRolePermissions(confirmWidening)

  const roleKeysWithPending = Object.keys(pendingWidenings)
  if (roleKeysWithPending.length > 0) {
    console.log("")
    console.log(applied ? "Newly granted (widened) this run:" : "NOT applied — re-run with --confirm-widening to grant these:")
    for (const roleKey of roleKeysWithPending) {
      console.log(`  ${roleKey}: ${pendingWidenings[roleKey].join(", ")}`)
    }
    console.log("")
  }

  console.log(
    `Auth seed complete. Permissions/roles upserted. Role-permission grants: ${
      roleKeysWithPending.length === 0 ? "already fully in sync, nothing new." : applied ? "widened as listed above." : "unchanged — widening skipped (see above)."
    }`
  )
}

main()
  .catch((error) => {
    console.error("Auth seed failed:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
