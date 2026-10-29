"use client"

import { useTranslations } from "next-intl"
import { Network, Rows3 } from "lucide-react"

import { cn } from "@/lib/utils"

export type OrganizationView = "chart" | "list"

interface OrganizationViewToggleProps {
  value: OrganizationView
  onChange: (view: OrganizationView) => void
}

/** Same two-button segmented-control shape as Employees' own ViewToggle
 * (src/components/employees/view-toggle.tsx) — a sibling, not a shared
 * import, since that one is typed to EmployeeView ("card" | "list"), a
 * different pair of modes entirely. */
export function OrganizationViewToggle({ value, onChange }: OrganizationViewToggleProps) {
  const t = useTranslations("OrganizationChart.view")

  const options: { key: OrganizationView; icon: typeof Network; label: string }[] = [
    { key: "chart", icon: Network, label: t("chart") },
    { key: "list", icon: Rows3, label: t("list") },
  ]

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={value === option.key}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
            value === option.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <option.icon className="size-3.5" strokeWidth={1.75} />
          {option.label}
        </button>
      ))}
    </div>
  )
}
