import type { ActivityItem } from "@/types/employee"

export const recentActivities: ActivityItem[] = [
  {
    id: "ACT-501",
    type: "hire",
    actor: "Ava Whitfield",
    role: "Senior Product Designer",
    department: "Design",
    timestamp: "2026-07-21T09:12:00Z",
  },
  {
    id: "ACT-500",
    type: "leaveRequest",
    actor: "Priya Nair",
    days: 5,
    timestamp: "2026-07-21T07:45:00Z",
  },
  {
    id: "ACT-499",
    type: "promotion",
    actor: "Daniel Kowalski",
    role: "Senior Financial Analyst",
    timestamp: "2026-07-20T15:30:00Z",
  },
  {
    id: "ACT-498",
    type: "review",
    actor: "Sofia Marchetti",
    period: "Q2",
    timestamp: "2026-07-20T11:05:00Z",
  },
  {
    id: "ACT-497",
    type: "document",
    actor: "Marcus Chen",
    timestamp: "2026-07-19T16:20:00Z",
  },
  {
    id: "ACT-496",
    type: "offboarding",
    actor: "Ethan Brooks",
    timestamp: "2026-07-18T13:50:00Z",
  },
]
