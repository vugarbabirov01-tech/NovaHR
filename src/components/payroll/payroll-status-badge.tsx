import { cn } from "@/lib/utils"
import type { PayrollPeriodStatus } from "@/types/payroll"

interface PayrollStatusBadgeProps {
  status: PayrollPeriodStatus
  label: string
}

/** Same dot + pill visual language as WorkStatusBadge/AttendanceStatusBadge
 * — a different Record for a different status axis (PayrollPeriodStatus),
 * never reusing either of those components' own status-keyed maps. */
const toneClassName: Record<PayrollPeriodStatus, string> = {
  DRAFT: "text-muted-foreground",
  CALCULATED: "text-sky-700",
  APPROVED: "text-amber-700",
  PAID: "text-status-good",
  CLOSED: "text-status-good",
}

const dotClassName: Record<PayrollPeriodStatus, string> = {
  DRAFT: "bg-muted-foreground",
  CALCULATED: "bg-sky-500",
  APPROVED: "bg-status-warning",
  PAID: "bg-status-good",
  CLOSED: "bg-status-good",
}

export function PayrollStatusBadge({ status, label }: PayrollStatusBadgeProps) {
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
