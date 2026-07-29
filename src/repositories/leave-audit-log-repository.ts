import { prisma } from "@/lib/prisma"
import type { LeaveAuditLogEntryModel } from "@/generated/prisma/models"

export type { LeaveAuditLogEntryModel as LeaveAuditLogEntry }

/**
 * Generic, cross-entity audit trail (entityType/entityId instead of being
 * embedded on one aggregate — see the schema.prisma model comment). Append-
 * only, same reasoning as the ledger: an audit trail that could be edited
 * isn't an audit trail. Written to via src/lib/leave/leave-audit.ts's
 * recordLeaveAudit() helper, not called directly by action files.
 */
export interface LeaveAuditLogEntryInput {
  entityType: string
  entityId: string
  action: string
  actor: string
  field?: string | null
  oldValue?: string | null
  newValue?: string | null
}

export function findLeaveAuditLogEntriesForEntity(
  entityType: string,
  entityId: string
): Promise<LeaveAuditLogEntryModel[]> {
  return prisma.leaveAuditLogEntry.findMany({
    where: { entityType, entityId },
    orderBy: { timestamp: "desc" },
  })
}

export function createLeaveAuditLogEntry(
  input: LeaveAuditLogEntryInput
): Promise<LeaveAuditLogEntryModel> {
  return prisma.leaveAuditLogEntry.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actor: input.actor,
      field: input.field ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
    },
  })
}
