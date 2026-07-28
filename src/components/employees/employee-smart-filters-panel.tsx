"use client"

import { useId, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown, Sparkles, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HR_SETTINGS } from "@/lib/hr-settings"
import { computeSmartFilterMatches, getEmployeeSmartFilters } from "@/lib/employee-smart-filters"
import type { EmployeeListItem } from "@/types/employee-profile"

interface EmployeeSmartFiltersPanelProps {
  employees: EmployeeListItem[]
  selectedId: string
  onSelect: (id: string) => void
}

/**
 * Ağıllı Filtrlər — dynamic, business-rule-driven employee views. Purely a
 * consumer of the Smart Filters registry (employee-smart-filters.ts): every
 * chip, its count, and its click behavior comes from iterating that registry,
 * never a switch statement here, so a filter registered by a future module
 * shows up with zero changes to this component.
 */
export function EmployeeSmartFiltersPanel({ employees, selectedId, onSelect }: EmployeeSmartFiltersPanelProps) {
  const t = useTranslations("Employees.smartFilters")
  const [expanded, setExpanded] = useState(true)
  const contentId = useId()

  const filters = getEmployeeSmartFilters()
  // One pass over `employees` computes every filter's matches (and count)
  // together — recomputed only when the underlying employee list changes,
  // not on every Search/Status/Advanced Filters interaction.
  const matches = useMemo(() => computeSmartFilterMatches(employees), [employees])

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" strokeWidth={1.75} />
          <span className="text-sm font-medium text-foreground">{t("sectionTitle")}</span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
          strokeWidth={1.75}
        />
      </button>

      {expanded ? (
        <div id={contentId} className="flex flex-col gap-3 border-t border-border px-4 pt-3 pb-4">
          <p className="text-xs text-muted-foreground">{t("sectionDescription")}</p>
          <div role="group" aria-label={t("sectionTitle")} className="flex flex-wrap gap-2">
            {filters.map((filter) => {
              const count = matches[filter.id]?.length ?? 0
              const isActive = selectedId === filter.id
              const params = filter.messageParams?.(HR_SETTINGS)
              const Icon = filter.icon

              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={isActive}
                  title={t(filter.descriptionKey, params)}
                  onClick={() => onSelect(isActive ? "" : filter.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />
                  {t(filter.titleKey, params)}
                  <span className="tabular-nums opacity-80">({count})</span>
                </button>
              )
            })}
          </div>

          {selectedId ? (
            <div>
              <Button variant="ghost" size="sm" onClick={() => onSelect("")}>
                <X className="size-3.5" strokeWidth={1.75} />
                {t("clear")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
