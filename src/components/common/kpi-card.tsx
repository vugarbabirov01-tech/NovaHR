import type { LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

interface KpiCardProps {
  label: string
  value: string
  delta?: number
  deltaLabel?: string
  icon: LucideIcon
  className?: string
}

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  className,
}: KpiCardProps) {
  const isPositive = (delta ?? 0) >= 0

  return (
    <Card className={cn(className)}>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-heading text-2xl font-semibold tracking-tight text-foreground tabular-nums">
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
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent">
          <Icon className="size-4 text-accent-foreground" strokeWidth={1.75} />
        </div>
      </CardContent>
    </Card>
  )
}
