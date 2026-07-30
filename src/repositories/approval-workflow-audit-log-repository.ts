import { prisma } from "@/lib/prisma"
import type { ApprovalWorkflowAuditLogEntryModel } from "@/generated/prisma/models"

export type { ApprovalWorkflowAuditLogEntryModel as ApprovalWorkflowAuditLogEntry }

/**
 * Generic, cross-entity audit trail for the Definition/Version/Step
 * authoring aggregate — deliberately the same shape as
 * leave-audit-log-repository.ts (entityType/entityId/action/actor).
 * Append-only, same discipline as every other audit table in this
 * codebase: no update/delete export. Written to via a future
 * recordApprovalWorkflowAudit() helper, not called directly by action
 * files — mirrors src/lib/leave/leave-audit.ts.
 */
export interface ApprovalWorkflowAuditLogEntryInput {
  entityType: string
  entityId: string
  action: string
  actor: string
  field?: string | null
  oldValue?: string | null
  newValue?: string | null
}

export function findApprovalWorkflowAuditLogEntriesForEntity(
  entityType: string,
  entityId: string
): Promise<ApprovalWorkflowAuditLogEntryModel[]> {
  return prisma.approvalWorkflowAuditLogEntry.findMany({
    where: { entityType, entityId },
    orderBy: { timestamp: "desc" },
  })
}

export function createApprovalWorkflowAuditLogEntry(
  input: ApprovalWorkflowAuditLogEntryInput
): Promise<ApprovalWorkflowAuditLogEntryModel> {
  return prisma.approvalWorkflowAuditLogEntry.create({
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
