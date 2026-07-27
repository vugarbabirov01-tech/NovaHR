import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface TimelineEntry {
  id: string
  icon: LucideIcon
  title: ReactNode
  description?: ReactNode
  meta?: ReactNode
  iconClassName?: string
}

interface TimelineProps {
  entries: TimelineEntry[]
  className?: string
}

export function Timeline({ entries, className }: TimelineProps) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {entries.map((entry, index) => {
        const Icon = entry.icon
        const isLast = index === entries.length - 1

        return (
          <li key={entry.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground",
                  entry.iconClassName
                )}
              >
                <Icon className="size-3.5" strokeWidth={2} />
              </span>
              {!isLast ? <span className="w-px flex-1 bg-border" /> : null}
            </div>
            <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", !isLast && "pb-5")}>
              <p className="text-sm font-medium text-foreground">{entry.title}</p>
              {entry.description ? (
                <p className="text-sm text-muted-foreground">{entry.description}</p>
              ) : null}
              {entry.meta ? (
                <span className="text-xs text-muted-foreground/80">{entry.meta}</span>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
