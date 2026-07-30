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
