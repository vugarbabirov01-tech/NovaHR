"use client"

import { useTranslations } from "next-intl"

import type { EmploymentStatus } from "@/types/employee-profile"
import { statusMessageKeys, statusTextClassName, statusToneClassName } from "@/lib/employees"
import { cn } from "@/lib/utils"

interface EmploymentStatusBadgeProps {
  status: EmploymentStatus
  className?: string
}

export function EmploymentStatusBadge({ status, className }: EmploymentStatusBadgeProps) {
  const t = useTranslations("Status")

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium",
        statusTextClassName[status],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", statusToneClassName[status])} />
      {t(statusMessageKeys[status])}
    </span>
  )
}
