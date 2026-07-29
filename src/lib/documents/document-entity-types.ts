/**
 * Known entityType values for the generic Document module — typo-safety
 * only, same reasoning as OffboardingEventType/LeaveEventType. Document
 * itself stores entityType as a plain string; a future module (Employee,
 * Contract, Training, Payroll, Attendance, Termination, Performance, ...)
 * adds its own key here when it needs one, with zero migration.
 */
export const DocumentEntityType = {
  LeaveRequest: "LEAVE_REQUEST",
} as const

export type DocumentEntityTypeName = (typeof DocumentEntityType)[keyof typeof DocumentEntityType]
