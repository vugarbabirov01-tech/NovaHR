"use client"

import { useTranslations } from "next-intl"
import { LayoutGrid, List } from "lucide-react"

import { cn } from "@/lib/utils"
import type { EmployeeView } from "@/types/employee-filters"

interface ViewToggleProps {
  value: EmployeeView
  onChange: (view: EmployeeView) => void
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  const t = useTranslations("Employees.list")

  const options: { key: EmployeeView; icon: typeof LayoutGrid; label: string }[] = [
    { key: "card", icon: LayoutGrid, label: t("cardView") },
    { key: "list", icon: List, label: t("listView") },
  ]

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={value === option.key}
          aria-label={option.label}
          title={option.label}
          className={cn(
            "flex size-7 items-center justify-center rounded-md transition-colors",
            value === option.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <option.icon className="size-4" strokeWidth={1.75} />
        </button>
      ))}
    </div>
  )
}
