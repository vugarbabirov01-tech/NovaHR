import { utcMidnightOfLocalDate } from "@/lib/leave/leave-active-status"
import type { LeaveRequestLifecycleStatus } from "@/generated/prisma/enums"

/**
 * The one place a LeaveRequestLifecycleStatus maps to a translation key
 * and a badge color — shared by the Employee Profile Leave tab and the HR
 * /leave dashboard so the same status always reads the same way in both
 * places. Both consumers translate through the existing
 * "Employees.profile.leave.requestStatus" namespace (generic copy —
 * "Pending Approval", "Approved", ... — not employee-tab-specific), so no
 * new translation namespace was needed for the HR page either.
 */
export const leaveRequestStatusMessageKeys: Record<LeaveRequestLifecycleStatus, string> = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  PENDING_APPROVAL: "pendingApproval",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  WITHDRAWN: "withdrawn",
}

export const leaveRequestStatusBadgeVariant: Record<
  LeaveRequestLifecycleStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "outline",
  SUBMITTED: "secondary",
  PENDING_APPROVAL: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "outline",
  WITHDRAWN: "outline",
}

/**
 * APPROVED is no longer one state — now that approval happens at creation,
 * what used to need a separate decision step is really "where is this
 * leave in time": not started yet, happening right now, or already over.
 * CANCELLED stays its own thing (an HR decision, not a date fact). Every
 * other LeaveRequestLifecycleStatus (DRAFT/SUBMITTED/PENDING_APPROVAL/
 * REJECTED/WITHDRAWN) can't occur on a request created after this change,
 * but a row from before it still can — those fall through to the plain
 * status maps above unchanged, so a stray historical status never mis-
 * renders as one of the three new time-based ones.
 */
export type LeaveRequestDisplayStatus = "scheduled" | "active" | "completed" | LeaveRequestLifecycleStatus

export function deriveLeaveRequestDisplayStatus(
  request: { status: LeaveRequestLifecycleStatus; startDate: Date; endDate: Date },
  asOfDate: Date = new Date()
): LeaveRequestDisplayStatus {
  if (request.status !== "APPROVED") return request.status
  const today = utcMidnightOfLocalDate(asOfDate)
  if (today < request.startDate) return "scheduled"
  if (today > request.endDate) return "completed"
  return "active"
}

export const leaveRequestDisplayStatusMessageKeys: Record<LeaveRequestDisplayStatus, string> = {
  ...leaveRequestStatusMessageKeys,
  scheduled: "scheduled",
  active: "active",
  completed: "completed",
}

export const leaveRequestDisplayStatusBadgeVariant: Record<
  LeaveRequestDisplayStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ...leaveRequestStatusBadgeVariant,
  scheduled: "secondary",
  active: "default",
  completed: "outline",
}
