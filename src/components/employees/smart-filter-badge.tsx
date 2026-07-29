"use client"

import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { getSmartFilterSeverityStyles, type SmartFilterDefinition } from "@/lib/employee-smart-filters"

interface SmartFilterBadgeProps {
  filter: SmartFilterDefinition
  className?: string
}

/**
 * Temporary "why is this employee showing up" badge — visible only while an
 * HR Action Center card is active, never persisted. Styling comes from the
 * same severity map the status cards use (getSmartFilterSeverityStyles), so
 * a card's color and its employees' badges never drift apart.
 */
export function SmartFilterBadge({ filter, className }: SmartFilterBadgeProps) {
  const t = useTranslations("Employees.smartFilters")
  const styles = getSmartFilterSeverityStyles(filter.severity)

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        styles.badge,
        className
      )}
    >
      <span aria-hidden="true">{filter.emoji}</span>
      {t(filter.badgeKey)}
    </span>
  )
}
