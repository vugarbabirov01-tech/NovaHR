import type { PrismaClient } from "@/generated/prisma/client"
import type { ScopeType } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { isUniqueConstraintConflictOn } from "@/lib/prisma-unique-conflict"
import { findRoleByKey } from "@/repositories/role-repository"
import { findCompanyById } from "@/repositories/company-repository"
import { findBranchById } from "@/repositories/branch-repository"
import {
  createUserRoleAssignment,
  findActiveAssignmentByKey,
  findActiveAssignmentsForUser,
  findAssignmentById,
  revokeUserRoleAssignment as revokeUserRoleAssignmentRepo,
  type UserRoleAssignment,
} from "@/repositories/user-role-assignment-repository"
import { AuthAuditAction, recordAuthAudit } from "@/lib/auth/auth-audit"
import type { RoleKey } from "@/lib/auth/role-permission-matrix"

export class InvalidScopeError extends Error {}
export class RoleScopeViolationError extends Error {}
export class UnknownRoleError extends Error {}

export interface CreateAssignmentInput {
  userId: string
  roleKey: RoleKey
  scopeType: ScopeType
  scopeId?: string | null
  assignedBy: string
}

/**
 * Three rules a database constraint cannot express (see each rule's own
 * reasoning): GLOBAL implies a null scopeId; COMPANY/BRANCH implies a
 * scopeId that names a real, currently-active Company/Branch; SUPER_ADMIN
 * is only ever GLOBAL. Runs BEFORE any transaction starts — these are
 * pure reads, nothing here needs to be atomic with the insert itself.
 * findCompanyById/findBranchById deliberately always read the one real,
 * live Company/Branch catalog (no client override) — there is only ever
 * one such catalog, unlike the auth-specific tables the caller below may
 * redirect to a different client for.
 */
async function validateScope(roleKey: RoleKey, scopeType: ScopeType, scopeId: string | null): Promise<void> {
  if (roleKey === "SUPER_ADMIN" && scopeType !== "GLOBAL") {
    throw new RoleScopeViolationError("SUPER_ADMIN can only be assigned with GLOBAL scope.")
  }

  if (scopeType === "GLOBAL") {
    if (scopeId !== null) throw new InvalidScopeError("GLOBAL scope requires scopeId to be null.")
    return
  }

  if (!scopeId) throw new InvalidScopeError(`${scopeType} scope requires a non-null scopeId.`)

  if (scopeType === "COMPANY") {
    const company = await findCompanyById(scopeId)
    if (!company) throw new InvalidScopeError(`No Company exists with id "${scopeId}".`)
    if (!company.active) throw new InvalidScopeError(`Company "${scopeId}" is archived, not active.`)
  } else if (scopeType === "BRANCH") {
    const branch = await findBranchById(scopeId)
    if (!branch) throw new InvalidScopeError(`No Branch exists with id "${scopeId}".`)
    if (!branch.active) throw new InvalidScopeError(`Branch "${scopeId}" is archived, not active.`)
  }
}

function isActiveKeyConflict(error: unknown): boolean {
  return isUniqueConstraintConflictOn(error, "activeKey")
}

/**
 * Idempotent by construction, same precedent as submitForApproval
 * (approval-engine-service.ts): if an active (userId, role, scope)
 * assignment already exists, returns it rather than creating a second
 * one — whether found by the up-front check below, or discovered by
 * losing a concurrent create race to the activeKey unique constraint.
 * That race is the actual "atomic mechanism" requested: an up-front
 * check alone has a window between the read and the write where two
 * concurrent calls can both pass; the database's own unique constraint
 * on activeKey is what closes it, this function just makes losing that
 * race look like a normal, successful (idempotent) return instead of an
 * error — see UserRoleAssignment.activeKey's own schema comment.
 */
/**
 * `client` defaults to the real singleton and is never threaded any
 * deeper than this function's own body — unlike the `tx`-composable
 * repository functions elsewhere in this codebase, this is a top-level
 * entry point, not meant to be nested inside a caller's own transaction
 * in Phase A. The override exists for one reason: UserRoleAssignment.
 * activeKey only exists once its own migration (see the Phase A follow-up
 * report) is applied, so tests exercise this function against a disposable,
 * schema-only sandbox client until then — never against real dev.db for
 * that specific column. Once that migration lands, callers can keep
 * omitting this parameter entirely.
 */
export async function createUserRoleAssignmentForRole(
  input: CreateAssignmentInput,
  client: PrismaClient = prisma
): Promise<UserRoleAssignment> {
  const role = await findRoleByKey(input.roleKey, client)
  if (!role) throw new UnknownRoleError(`Unknown role key: ${input.roleKey}`)

  const scopeId = input.scopeId ?? null
  await validateScope(input.roleKey, input.scopeType, scopeId)

  const existing = await findActiveAssignmentByKey(input.userId, role.id, input.scopeType, scopeId, client)
  if (existing) return existing

  try {
    return await client.$transaction(async (tx) => {
      const created = await createUserRoleAssignment(
        { userId: input.userId, roleId: role.id, scopeType: input.scopeType, scopeId, assignedBy: input.assignedBy },
        tx
      )
      await recordAuthAudit(
        {
          actorUserId: input.assignedBy,
          action: AuthAuditAction.RoleAssigned,
          targetType: "UserRoleAssignment",
          targetId: created.id,
          metadata: { userId: input.userId, roleKey: input.roleKey, scopeType: input.scopeType, scopeId },
        },
        tx
      )
      return created
    })
  } catch (error) {
    if (isActiveKeyConflict(error)) {
      const raceWinner = await findActiveAssignmentByKey(input.userId, role.id, input.scopeType, scopeId, client)
      if (raceWinner) return raceWinner
    }
    throw error
  }
}

export async function revokeUserRoleAssignment(
  assignmentId: string,
  revokedBy: string,
  client: PrismaClient = prisma
): Promise<UserRoleAssignment> {
  const existing = await findAssignmentById(assignmentId, client)
  if (!existing) throw new Error(`No UserRoleAssignment exists with id "${assignmentId}".`)
  if (existing.revokedAt) return existing // already revoked — idempotent, not an error

  return client.$transaction(async (tx) => {
    const revoked = await revokeUserRoleAssignmentRepo(assignmentId, tx)
    await recordAuthAudit(
      {
        actorUserId: revokedBy,
        action: AuthAuditAction.RoleRevoked,
        targetType: "UserRoleAssignment",
        targetId: assignmentId,
        metadata: { userId: existing.userId, roleId: existing.roleId },
      },
      tx
    )
    return revoked
  })
}

export function findActiveAssignments(userId: string, client: PrismaClient = prisma): Promise<UserRoleAssignment[]> {
  return findActiveAssignmentsForUser(userId, client)
}
