import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { UserRoleAssignmentModel } from "@/generated/prisma/models"
import type { ScopeType } from "@/generated/prisma/enums"

export type { UserRoleAssignmentModel as UserRoleAssignment }

/** "{userId}::{roleId}::{scopeType}::{scopeId ?? "GLOBAL"}" — see
 * UserRoleAssignment.activeKey's own schema comment for why this exact
 * shape (and the "GLOBAL" sentinel for a null scopeId) is what makes the
 * unique constraint actually catch a GLOBAL-scope duplicate too, not just
 * COMPANY/BRANCH ones. */
export function computeUserRoleAssignmentActiveKey(
  userId: string,
  roleId: string,
  scopeType: ScopeType,
  scopeId: string | null
): string {
  return `${userId}::${roleId}::${scopeType}::${scopeId ?? "GLOBAL"}`
}

export interface CreateUserRoleAssignmentInput {
  userId: string
  roleId: string
  scopeType: ScopeType
  scopeId: string | null
  assignedBy: string
}

/**
 * Sets activeKey from the input — the caller (the service layer) is
 * responsible for every OTHER integrity rule (scope/role validation, the
 * up-front "does an active one already exist" check); this function's
 * only job is the write, and the one thing only the database can actually
 * guarantee: throwing on a genuine activeKey collision (Prisma error
 * P2002) when two concurrent calls race past the service layer's own
 * check at the same time. See user-role-assignment-service.ts for how
 * that error is caught and turned into a clean application-level result.
 */
export function createUserRoleAssignment(
  input: CreateUserRoleAssignmentInput,
  client: PrismaClientOrTransaction = prisma
): Promise<UserRoleAssignmentModel> {
  return client.userRoleAssignment.create({
    data: {
      userId: input.userId,
      roleId: input.roleId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      assignedBy: input.assignedBy,
      activeKey: computeUserRoleAssignmentActiveKey(input.userId, input.roleId, input.scopeType, input.scopeId),
    },
  })
}

export function findActiveAssignmentByKey(
  userId: string,
  roleId: string,
  scopeType: ScopeType,
  scopeId: string | null,
  client: PrismaClientOrTransaction = prisma
): Promise<UserRoleAssignmentModel | null> {
  return client.userRoleAssignment.findUnique({
    where: { activeKey: computeUserRoleAssignmentActiveKey(userId, roleId, scopeType, scopeId) },
  })
}

export function findActiveAssignmentsForUser(
  userId: string,
  client: PrismaClientOrTransaction = prisma
): Promise<UserRoleAssignmentModel[]> {
  return client.userRoleAssignment.findMany({
    where: { userId, revokedAt: null },
    orderBy: { assignedAt: "desc" },
  })
}

export function findAssignmentById(
  id: string,
  client: PrismaClientOrTransaction = prisma
): Promise<UserRoleAssignmentModel | null> {
  return client.userRoleAssignment.findUnique({ where: { id } })
}

/** Nulls activeKey in the SAME write as setting revokedAt — frees the key
 * for a legitimate later re-grant (see the schema's own comment on why
 * this is what a plain unique constraint needs to behave correctly for
 * "no two ACTIVE rows" rather than "no two rows ever"). */
export function revokeUserRoleAssignment(
  id: string,
  client: PrismaClientOrTransaction = prisma
): Promise<UserRoleAssignmentModel> {
  return client.userRoleAssignment.update({
    where: { id },
    data: { revokedAt: new Date(), activeKey: null },
  })
}
