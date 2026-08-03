export interface UpcomingBirthday {
  id: string
  name: string
  avatarUrl?: string
  department: string
  date: string
}

interface ActivityBase {
  id: string
  actor: string
  avatarUrl?: string
  timestamp: string
}

export type ActivityItem = ActivityBase &
  (
    | { type: "hire"; role: string; department: string }
    | { type: "leaveRequest"; days: number }
    | { type: "promotion"; role: string }
    | { type: "review"; period: string }
    | { type: "document" }
    | { type: "offboarding" }
  )

export type ActivityType = ActivityItem["type"]
