import { createLeaveAuditLogEntry } from "@/repositories/leave-audit-log-repository"

/**
 * The entity-type vocabulary LeaveAuditLogEntry.entityType is drawn from.
 * A plain string column, not a Prisma enum (an audit trail benefits from
 * never rejecting a write over an unrecognized value), but centralizing the
 * known values here means every action file imports the same constants
 * instead of retyping string literals.
 */
export const LeaveAuditEntityType = {
  LeaveType: "LEAVE_TYPE",
  LeavePolicy: "LEAVE_POLICY",
  Holiday: "HOLIDAY",
  LeaveLedgerEntry: "LEAVE_LEDGER_ENTRY",
  LeaveRequest: "LEAVE_REQUEST",
} as const
export type LeaveAuditEntityTypeName = (typeof LeaveAuditEntityType)[keyof typeof LeaveAuditEntityType]

/**
 * The action-string vocabulary, dot-namespaced to match the convention
 * already used on EmployeeProfile.auditLog (e.g. "employee.terminated").
 * Every value used by a Phase 1 Server Action is listed here now — this is
 * the one place to keep in sync when a future UI adds the lookup maps that
 * render these (see the file-header comment in audit-log-tab.tsx's sibling
 * this module will eventually need: commit cfb43c1 fixed a bug caused by an
 * action string that was written but never registered in that UI's lookup
 * map, silently falling back to generic copy).
 */
export const LeaveAuditAction = {
  LeaveTypeCreated: "leave_type.created",
  LeaveTypeUpdated: "leave_type.updated",
  LeaveTypeArchived: "leave_type.archived",
  LeaveTypeRestored: "leave_type.restored",
  LeavePolicyCreated: "leave_policy.created",
  LeavePolicyUpdated: "leave_policy.updated",
  LeavePolicyArchived: "leave_policy.archived",
  LeavePolicyRestored: "leave_policy.restored",
  HolidayCreated: "holiday.created",
  HolidayUpdated: "holiday.updated",
  HolidayArchived: "holiday.archived",
  HolidayRestored: "holiday.restored",
  LeaveLedgerEntryRecorded: "leave_ledger_entry.recorded",
  LeaveRequestSubmitted: "leave_request.submitted",
  LeaveRequestApproved: "leave_request.approved",
  LeaveRequestRejected: "leave_request.rejected",
  LeaveRequestCancelled: "leave_request.cancelled",
} as const
export type LeaveAuditActionName = (typeof LeaveAuditAction)[keyof typeof LeaveAuditAction]

export interface RecordLeaveAuditInput {
  entityType: LeaveAuditEntityTypeName
  entityId: string
  action: LeaveAuditActionName
  /** Who performed the action. Every Phase 1 action is system/admin-
   * initiated (no request/approval UI yet), so callers pass a fixed actor
   * today — this parameter exists so a future authenticated caller doesn't
   * need this helper's signature to change. */
  actor: string
  field?: string
  oldValue?: string
  newValue?: string
}

/**
 * Called by each Phase 1 action right after its write succeeds, inside the
 * same try/catch — so a failed audit write surfaces as a failed action
 * rather than a silent gap in the trail. Not wrapped in a DB transaction
 * with the entity write yet (no repository in this codebase composes across
 * models via prisma.$transaction today); a future phase can tighten that if
 * it becomes a real requirement.
 */
export function recordLeaveAudit(input: RecordLeaveAuditInput): Promise<unknown> {
  return createLeaveAuditLogEntry({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actor: input.actor,
    field: input.field,
    oldValue: input.oldValue,
    newValue: input.newValue,
  })
}
