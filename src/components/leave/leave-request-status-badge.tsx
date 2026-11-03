"use client"

import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import {
  deriveLeaveRequestDisplayStatus,
  leaveRequestDisplayStatusMessageKeys,
  leaveRequestDisplayStatusBadgeVariant,
} from "@/lib/leave/leave-request-status-display"
import type { LeaveRequestLifecycleStatus } from "@/generated/prisma/enums"

interface LeaveRequestStatusBadgeProps {
  status: LeaveRequestLifecycleStatus
  startDate: Date
  endDate: Date
}

/**
 * The one renderer for a leave request's status badge. Resolves the raw
 * LeaveRequestLifecycleStatus into a Scheduled/Active/Completed/Cancelled
 * (or a legacy fallback) display status first — see
 * deriveLeaveRequestDisplayStatus's own doc comment for why APPROVED alone
 * isn't informative enough anymore now that it's set at creation time.
 */
export function LeaveRequestStatusBadge({ status, startDate, endDate }: LeaveRequestStatusBadgeProps) {
  const t = useTranslations("Employees.profile.leave.requestStatus")
  const displayStatus = deriveLeaveRequestDisplayStatus({ status, startDate, endDate })
  return (
    <Badge variant={leaveRequestDisplayStatusBadgeVariant[displayStatus] ?? "outline"}>
      {t(leaveRequestDisplayStatusMessageKeys[displayStatus] ?? "pendingApproval")}
    </Badge>
  )
}
