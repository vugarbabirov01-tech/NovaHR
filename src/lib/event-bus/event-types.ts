// Known offboarding event type names — typo-safety only. The bus itself
// accepts any string type; nothing here couples the bus to Offboarding.
export const OffboardingEventType = {
  OffboardingStarted: "OffboardingStarted",
  AssetReturnRequested: "AssetReturnRequested",
  PayrollSettlementRequested: "PayrollSettlementRequested",
  EmployeeTerminated: "EmployeeTerminated",
  TerminationCompleted: "TerminationCompleted",
  HRNotification: "HRNotification",
  PayrollNotification: "PayrollNotification",
  ITNotification: "ITNotification",
} as const

export type OffboardingEventTypeName = (typeof OffboardingEventType)[keyof typeof OffboardingEventType]
