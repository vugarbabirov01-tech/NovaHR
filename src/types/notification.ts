interface NotificationBase {
  id: string
  timestamp: string
}

export type NotificationItem = NotificationBase &
  (
    | { type: "leaveRequest"; name: string; days: number; date: string }
    | { type: "newCandidate"; role: string }
    | { type: "payrollCompleted"; monthDate: string }
  )
