import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface InfoFieldProps {
  label: string
  value: ReactNode
  className?: string
  span?: "1" | "2"
}

export function InfoField({ label, value, className, span = "1" }: InfoFieldProps) {
  return (
    <div className={cn(span === "2" && "sm:col-span-2", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">
        {value === "" || value === null || value === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

interface InfoGridProps {
  children: ReactNode
  className?: string
}

export function InfoGrid({ children, className }: InfoGridProps) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {children}
    </dl>
  )
}
