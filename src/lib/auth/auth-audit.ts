import type { PrismaClientOrTransaction } from "@/lib/prisma"
import { createAuthAuditLogEntry } from "@/repositories/auth-audit-log-repository"

/**
 * The action-string vocabulary for AuthAuditLogEntry — same dot-namespaced
 * convention as LeaveAuditAction. Every value a Phase A/B/C caller is
 * expected to write is listed here now, so a future audit-log UI (Phase E)
 * never has to guess at an unregistered string (see leave-audit.ts's own
 * comment on the bug class that caused).
 */
export const AuthAuditAction = {
  RoleAssigned: "user_role_assignment.assigned",
  RoleRevoked: "user_role_assignment.revoked",
  BootstrapSuperAdminCreated: "bootstrap.super_admin_created",
  BootstrapSuperAdminRecoveryExecuted: "bootstrap.super_admin_recovery_executed",
  // Phase B+ — not written by anything yet, listed ahead of time so the
  // vocabulary is already stable before login exists.
  LoginSucceeded: "auth.login_succeeded",
  LoginFailed: "auth.login_failed",
  Logout: "auth.logout",
  PasswordResetRequested: "auth.password_reset_requested",
  PasswordChanged: "auth.password_changed",
  PermissionDenied: "auth.permission_denied",
  ReportExported: "reports.exported",
} as const
export type AuthAuditActionName = (typeof AuthAuditAction)[keyof typeof AuthAuditAction]

export interface RecordAuthAuditInput {
  /** null for an action with no identified actor yet (e.g. a failed login
   * attempt before any user could be matched, or the bootstrap script
   * running before any User row exists). */
  actorUserId: string | null
  action: AuthAuditActionName
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Same transactional-composition convention as recordLeaveAudit: pass the
 * caller's own `tx` when this audit row must commit or roll back together
 * with the write it documents (e.g. createUserRoleAssignment), otherwise
 * omit `client` to write against the top-level `prisma` right after the
 * triggering write succeeds.
 */
export function recordAuthAudit(input: RecordAuthAuditInput, client?: PrismaClientOrTransaction): Promise<unknown> {
  return createAuthAuditLogEntry(
    {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
      ipAddress: input.ipAddress,
    },
    client
  )
}
