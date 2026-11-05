import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { RoleModel } from "@/generated/prisma/models"
import type { RoleKey } from "@/lib/auth/role-permission-matrix"

export type { RoleModel as Role }

export function findRoleByKey(key: RoleKey | string, client: PrismaClientOrTransaction = prisma): Promise<RoleModel | null> {
  return client.role.findUnique({ where: { key } })
}

export function findAllRoles(client: PrismaClientOrTransaction = prisma): Promise<RoleModel[]> {
  return client.role.findMany({ orderBy: { key: "asc" } })
}

export interface UpsertRoleInput {
  key: RoleKey
  name: string
  description?: string | null
}

/** Idempotent by key — the seed script calls this once per role in
 * role-permission-matrix.ts, safe to re-run any number of times. */
export function upsertRole(input: UpsertRoleInput, client: PrismaClientOrTransaction = prisma): Promise<RoleModel> {
  return client.role.upsert({
    where: { key: input.key },
    create: { key: input.key, name: input.name, description: input.description ?? null },
    update: { name: input.name, description: input.description ?? null },
  })
}
