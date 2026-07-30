"use client"

import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import {
  leaveRequestStatusMessageKeys,
  leaveRequestStatusBadgeVariant,
} from "@/lib/leave/leave-request-status-display"
import type { LeaveRequestLifecycleStatus } from "@/generated/prisma/enums"

interface LeaveRequestStatusBadgeProps {
  status: LeaveRequestLifecycleStatus
}

/**
 * The one renderer for a LeaveRequestLifecycleStatus badge — the Employee
 * Profile Leave tab and the HR /leave requests table used to each render
 * this identically inline (same variant lookup, same translation call,
 * copy-pasted). Both now render this component instead.
 */
export function LeaveRequestStatusBadge({ status }: LeaveRequestStatusBadgeProps) {
  const t = useTranslations("Employees.profile.leave.requestStatus")
  return (
    <Badge variant={leaveRequestStatusBadgeVariant[status] ?? "outline"}>
      {t(leaveRequestStatusMessageKeys[status] ?? "pendingApproval")}
    </Badge>
  )
}
