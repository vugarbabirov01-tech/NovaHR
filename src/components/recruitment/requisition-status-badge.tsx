import { cn } from "@/lib/utils"
import type { RequisitionStatus } from "@/lib/recruitment/recruitment-rules"

const toneClassName: Record<RequisitionStatus, string> = {
  DRAFT: "text-muted-foreground",
  PENDING_APPROVAL: "text-amber-700",
  OPEN: "text-sky-700",
  REJECTED: "text-destructive",
  FILLED: "text-status-good",
  CLOSED: "text-muted-foreground",
}

const dotClassName: Record<RequisitionStatus, string> = {
  DRAFT: "bg-muted-foreground",
  PENDING_APPROVAL: "bg-status-warning",
  OPEN: "bg-sky-500",
  REJECTED: "bg-destructive",
  FILLED: "bg-status-good",
  CLOSED: "bg-muted-foreground",
}

/** Same dot + pill language as the payroll / work-status badges. */
export function RequisitionStatusBadge({ status, label }: { status: RequisitionStatus; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClassName[status]
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClassName[status])} />
      {label}
    </span>
  )
}
