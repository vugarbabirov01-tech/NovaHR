"use client"

import { useTranslations } from "next-intl"

import {
  workStatusMessageKeys,
  workStatusTextClassName,
  workStatusToneClassName,
  type WorkStatus,
} from "@/lib/employee-work-status"
import { cn } from "@/lib/utils"

interface WorkStatusBadgeProps {
  status: WorkStatus
  className?: string
}

/**
 * The live, day-to-day counterpart to EmploymentStatusBadge — same visual
 * language (dot + label pill) but a different axis entirely: this reflects
 * whether the employee is at work right now, computed by resolveWorkStatus
 * from approved leave requests, never from employmentStatus. Every surface
 * that shows a work status renders this one component; none of them should
 * ever re-derive the dot color or label locally.
 */
export function WorkStatusBadge({ status, className }: WorkStatusBadgeProps) {
  const t = useTranslations("WorkStatus")

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium",
        workStatusTextClassName[status],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", workStatusToneClassName[status])} />
      {t(workStatusMessageKeys[status])}
    </span>
  )
}
