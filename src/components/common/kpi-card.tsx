import type { LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { InfoTooltip } from "@/components/common/info-tooltip"

interface KpiCardProps {
  label: string
  value: string
  delta?: number
  deltaLabel?: string
  icon: LucideIcon
  /** Optional short explanation shown via an info icon next to the label —
   * for a metric that isn't self-evident at a glance (e.g. "Carried
   * Forward"). Omit for self-explanatory metrics; existing callers that
   * don't pass this render exactly as before. */
  tooltip?: string
  className?: string
}

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  tooltip,
  className,
}: KpiCardProps) {
  const isPositive = (delta ?? 0) >= 0

  return (
    <Card className={cn("h-full min-w-0", className)}>
      <CardContent className="flex h-full items-center justify-between gap-3">
        {/* min-w-0 lets this column shrink/truncate instead of forcing the
         * row wider than the card — without it, a long label pushes the
         * icon past the card's own overflow-hidden edge instead of
         * wrapping or clipping cleanly. */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm text-muted-foreground">{label}</p>
            {tooltip ? <InfoTooltip content={tooltip} /> : null}
          </div>
          <p className="truncate font-heading text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          {typeof delta === "number" ? (
            <div
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                isPositive ? "text-status-good" : "text-status-critical"
              )}
            >
              {isPositive ? (
                <ArrowUpRight className="size-3.5" strokeWidth={2.25} />
              ) : (
                <ArrowDownRight className="size-3.5" strokeWidth={2.25} />
              )}
              <span>{Math.abs(delta).toFixed(1)}%</span>
              {deltaLabel ? (
                <span className="font-normal text-muted-foreground">
                  {deltaLabel}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex size-9 shrink-0 self-center items-center justify-center rounded-lg bg-accent">
          <Icon className="size-4 shrink-0 text-accent-foreground" strokeWidth={1.75} />
        </div>
      </CardContent>
    </Card>
  )
}
