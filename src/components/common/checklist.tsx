"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export interface ChecklistItem {
  key: string
  label: string
}

interface ChecklistProps {
  items: ChecklistItem[]
  value: Record<string, boolean>
  onChange: (value: Record<string, boolean>) => void
  completionLabel: (percent: number) => string
  className?: string
}

/** Generic reusable checkbox checklist with a completion percentage —
 * not specific to Offboarding, any future module can reuse this. */
export function Checklist({ items, value, onChange, completionLabel, className }: ChecklistProps) {
  const completed = items.filter((item) => value[item.key]).length
  const percent = items.length === 0 ? 0 : Math.round((completed / items.length) * 100)

  function toggle(key: string, checked: boolean) {
    onChange({ ...value, [key]: checked })
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{completionLabel(percent)}</span>
          <span className="font-medium text-foreground tabular-nums">{percent}%</span>
        </div>
        <Progress value={percent} />
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.key}>
            <label className="group/field flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-accent">
              <Checkbox
                checked={value[item.key] ?? false}
                onCheckedChange={(checked) => toggle(item.key, checked === true)}
              />
              <span className="text-foreground">{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
