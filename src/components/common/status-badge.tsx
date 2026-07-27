"use client"

import { useTranslations } from "next-intl"

import type { EmployeeStatus } from "@/types/employee"
import { cn } from "@/lib/utils"

const statusConfig: Record<
  EmployeeStatus,
  { messageKey: "active" | "onLeave" | "inactive"; dotClassName: string; textClassName: string }
> = {
  active: {
    messageKey: "active",
    dotClassName: "bg-status-good",
    textClassName: "text-status-good",
  },
  "on-leave": {
    messageKey: "onLeave",
    dotClassName: "bg-status-warning",
    textClassName: "text-amber-700",
  },
  inactive: {
    messageKey: "inactive",
    dotClassName: "bg-muted-foreground",
    textClassName: "text-muted-foreground",
  },
}

interface StatusBadgeProps {
  status: EmployeeStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const t = useTranslations("Status")
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium",
        config.textClassName,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dotClassName)} />
      {t(config.messageKey)}
    </span>
  )
}
