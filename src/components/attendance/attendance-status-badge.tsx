import { cn } from "@/lib/utils"
import type { AttendanceStatus } from "@/types/integrations/attendance"

interface AttendanceStatusBadgeProps {
  status: AttendanceStatus
  label: string
}

/**
 * Same dot + pill visual language as WorkStatusBadge (employees/
 * work-status-badge.tsx) — deliberately not that component itself, since
 * its Record is keyed by Nova's own WorkStatus union, a different set of
 * values than AttendanceQR's live-board status strings. No "use client":
 * this only ever renders inside AttendanceTenantSection, an async Server
 * Component that resolves `label` itself via getTranslations — there's no
 * interactivity here to justify a client boundary.
 */
const toneClassName: Record<AttendanceStatus, string> = {
  OnTime: "text-status-good",
  Field: "text-status-good",
  Incomplete: "text-status-good", // this provider only ever asks for today — "still at work"
  Late: "text-amber-700",
  Absent: "text-status-critical",
  OnLeave: "text-sky-700",
  Permission: "text-sky-700",
  DayOff: "text-muted-foreground",
  Pending: "text-muted-foreground",
  Onboarding: "text-muted-foreground",
}

const dotClassName: Record<AttendanceStatus, string> = {
  OnTime: "bg-status-good",
  Field: "bg-status-good",
  Incomplete: "bg-status-good",
  Late: "bg-status-warning",
  Absent: "bg-status-critical",
  OnLeave: "bg-sky-500",
  Permission: "bg-sky-500",
  DayOff: "bg-muted-foreground",
  Pending: "bg-muted-foreground",
  Onboarding: "bg-muted-foreground",
}

export function AttendanceStatusBadge({ status, label }: AttendanceStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium",
        toneClassName[status]
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClassName[status])} />
      {label}
    </span>
  )
}
