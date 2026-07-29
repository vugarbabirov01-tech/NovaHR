// Known Leave Management event type names — typo-safety only, same
// reasoning as event-types.ts (Offboarding's own file, untouched by this
// module): the bus itself accepts any string type, nothing here couples it
// to Leave. A sibling file rather than additions to OffboardingEventType,
// since the two modules' event vocabularies are unrelated.
//
// Nothing publishes to these yet — no Phase 1 action performs the request
// submission/approval/adjustment workflow these describe. They're defined
// now so Phase 2's actions can import and publish through the existing
// eventBus without this file needing to be designed then.
export const LeaveEventType = {
  LeaveRequestSubmitted: "LeaveRequestSubmitted",
  LeaveRequestApproved: "LeaveRequestApproved",
  LeaveRequestRejected: "LeaveRequestRejected",
  LeaveRequestCancelled: "LeaveRequestCancelled",
  LeaveBalanceAdjusted: "LeaveBalanceAdjusted",
  LeaveOpeningBalanceImported: "LeaveOpeningBalanceImported",
} as const

export type LeaveEventTypeName = (typeof LeaveEventType)[keyof typeof LeaveEventType]
