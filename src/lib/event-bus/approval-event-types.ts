// Known Approval Engine event type names — typo-safety only, same
// reasoning as leave-event-types.ts/event-types.ts: the bus itself accepts
// any string type, nothing here couples it to the engine. Only the events
// Phase 4C actually publishes are listed — delegation/escalation events
// are Phase 4E/4F's own concern and get their own constants when those
// phases exist, the same way LeaveEventType didn't need to anticipate
// every future Leave event either.
//
// Payloads are always IDs only, never full objects — a subscriber that
// needs more fetches it fresh, keeping publish cheap and consumers always
// looking at current data rather than a stale snapshot embedded in the
// event.
export const ApprovalEventType = {
  ApprovalInstanceCreated: "ApprovalInstanceCreated",
  ApprovalStepActivated: "ApprovalStepActivated",
  ApprovalStepApproved: "ApprovalStepApproved",
  ApprovalStepRejected: "ApprovalStepRejected",
  ApprovalStepReturned: "ApprovalStepReturned",
  ApprovalInstanceApproved: "ApprovalInstanceApproved",
  ApprovalInstancePartiallyApproved: "ApprovalInstancePartiallyApproved",
  ApprovalInstanceRejected: "ApprovalInstanceRejected",
  ApprovalInstanceReturned: "ApprovalInstanceReturned",
  ApprovalInstanceCancelled: "ApprovalInstanceCancelled",
  ApprovalInstanceReopened: "ApprovalInstanceReopened",
} as const

export type ApprovalEventTypeName = (typeof ApprovalEventType)[keyof typeof ApprovalEventType]

export interface ApprovalInstanceEventPayload {
  entityType: string
  entityId: string
  instanceId: string
}

export interface ApprovalStepEventPayload {
  entityType: string
  entityId: string
  instanceId: string
  stepInstanceId: string
  approverEmployeeId?: string
}
