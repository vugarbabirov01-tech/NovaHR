import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { PermissionModel } from "@/generated/prisma/models"
import type { PermissionKey } from "@/lib/auth/permissions"

export type { PermissionModel as Permission }

export function findPermissionByKey(
  key: PermissionKey | string,
  client: PrismaClientOrTransaction = prisma
): Promise<PermissionModel | null> {
  return client.permission.findUnique({ where: { key } })
}

export function findAllPermissions(client: PrismaClientOrTransaction = prisma): Promise<PermissionModel[]> {
  return client.permission.findMany({ orderBy: { key: "asc" } })
}

export interface UpsertPermissionInput {
  key: PermissionKey
  description?: string | null
}

/** Idempotent by key — same seed-script convention as upsertRole. */
export function upsertPermission(
  input: UpsertPermissionInput,
  client: PrismaClientOrTransaction = prisma
): Promise<PermissionModel> {
  return client.permission.upsert({
    where: { key: input.key },
    create: { key: input.key, description: input.description ?? null },
    update: { description: input.description ?? null },
  })
}

/** Idempotent, keyed by (roleId, permissionId) — safe to re-run. Does NOT
 * remove permissions the role no longer has in the matrix; the seed
 * script's own caller is responsible for diffing if a permission must be
 * revoked from a role (a one-off decision, not this function's job). */
export function grantPermissionToRole(
  roleId: string,
  permissionId: string,
  client: PrismaClientOrTransaction = prisma
) {
  return client.rolePermission.upsert({
    where: { roleId_permissionId: { roleId, permissionId } },
    create: { roleId, permissionId },
    update: {},
  })
}

export function findPermissionsForRole(roleId: string, client: PrismaClientOrTransaction = prisma) {
  return client.rolePermission.findMany({ where: { roleId }, include: { permission: true } })
}
