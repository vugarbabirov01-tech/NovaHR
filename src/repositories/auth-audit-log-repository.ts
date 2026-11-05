import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { AuthAuditLogEntryModel } from "@/generated/prisma/models"

export type { AuthAuditLogEntryModel as AuthAuditLogEntry }

/** Append-only — no update path, same discipline as LeaveAuditLogEntry.
 * Written to exclusively via src/lib/auth/auth-audit.ts's
 * recordAuthAudit(), never called directly. */
export interface AuthAuditLogEntryInput {
  actorUserId?: string | null
  action: string
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | null
  ipAddress?: string | null
}

export function createAuthAuditLogEntry(
  input: AuthAuditLogEntryInput,
  client: PrismaClientOrTransaction = prisma
): Promise<AuthAuditLogEntryModel> {
  return client.authAuditLogEntry.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ? (input.metadata as object) : undefined,
      ipAddress: input.ipAddress ?? null,
    },
  })
}

export function findAuthAuditLogEntriesForActor(
  actorUserId: string,
  client: PrismaClientOrTransaction = prisma
): Promise<AuthAuditLogEntryModel[]> {
  return client.authAuditLogEntry.findMany({
    where: { actorUserId },
    orderBy: { timestamp: "desc" },
  })
}
