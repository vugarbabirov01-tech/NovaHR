import type { NotificationItem } from "@/types/notification"

export const notifications: NotificationItem[] = [
  {
    id: "N-1",
    type: "leaveRequest",
    name: "Priya Nair",
    days: 5,
    date: "2026-08-04",
    timestamp: "2026-07-23T09:15:00Z",
  },
  {
    id: "N-2",
    type: "newCandidate",
    role: "Senior Backend Engineer",
    timestamp: "2026-07-23T08:20:00Z",
  },
  {
    id: "N-3",
    type: "payrollCompleted",
    monthDate: "2026-07-01",
    timestamp: "2026-07-23T06:05:00Z",
  },
]
