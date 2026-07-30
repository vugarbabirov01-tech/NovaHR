import { createApprovalWorkflowAuditLogEntry } from "@/repositories/approval-workflow-audit-log-repository"

/**
 * The entity-type vocabulary ApprovalWorkflowAuditLogEntry.entityType is
 * drawn from — same reasoning as src/lib/leave/leave-audit.ts's
 * LeaveAuditEntityType: a plain string column (an audit trail should never
 * reject a write over an unrecognized value), centralized here so every
 * authoring action file imports the same constants instead of retyping
 * string literals. This is the authoring aggregate's own vocabulary
 * (Definition/Version) — unrelated to ApprovableEntityType (the business
 * modules the *engine itself* serves, e.g. LEAVE_REQUEST), which this file
 * never references.
 */
export const ApprovalWorkflowAuditEntityType = {
  WorkflowDefinition: "APPROVAL_WORKFLOW_DEFINITION",
  WorkflowVersion: "APPROVAL_WORKFLOW_VERSION",
} as const
export type ApprovalWorkflowAuditEntityTypeName =
  (typeof ApprovalWorkflowAuditEntityType)[keyof typeof ApprovalWorkflowAuditEntityType]

/** Dot-namespaced action vocabulary, matching the convention
 * src/lib/leave/leave-audit.ts already established. */
export const ApprovalWorkflowAuditAction = {
  DefinitionCreated: "approval_workflow_definition.created",
  DefinitionUpdated: "approval_workflow_definition.updated",
  DefinitionArchived: "approval_workflow_definition.archived",
  DefinitionRestored: "approval_workflow_definition.restored",
  DefinitionCloned: "approval_workflow_definition.cloned",
  VersionCreated: "approval_workflow_version.created",
  VersionPublished: "approval_workflow_version.published",
  VersionCloned: "approval_workflow_version.cloned",
  VersionStepsReplaced: "approval_workflow_version.steps_replaced",
} as const
export type ApprovalWorkflowAuditActionName =
  (typeof ApprovalWorkflowAuditAction)[keyof typeof ApprovalWorkflowAuditAction]

export interface RecordApprovalWorkflowAuditInput {
  entityType: ApprovalWorkflowAuditEntityTypeName
  entityId: string
  action: ApprovalWorkflowAuditActionName
  /** Who performed the action. No auth system exists yet in this codebase
   * (see the Phase 3 architecture notes) — every caller passes an explicit
   * actor today, same discipline as leave-audit.ts's actor parameter, so a
   * future authenticated caller never needs this helper's signature to
   * change. */
  actor: string
  field?: string
  oldValue?: string
  newValue?: string
}

/**
 * Called by each authoring service operation right after its write
 * succeeds, inside the same try/catch — a failed audit write surfaces as a
 * failed operation rather than a silent gap in the trail. Same caveat as
 * leave-audit.ts: not wrapped in the same DB transaction as the entity
 * write (except VersionStepsReplaced, whose underlying repository call is
 * already transactional on its own).
 */
export function recordApprovalWorkflowAudit(input: RecordApprovalWorkflowAuditInput): Promise<unknown> {
  return createApprovalWorkflowAuditLogEntry({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actor: input.actor,
    field: input.field,
    oldValue: input.oldValue,
    newValue: input.newValue,
  })
}
