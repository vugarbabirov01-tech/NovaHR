"use client"

import { useId, useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown, ChevronRight, Sparkles, X, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HR_SETTINGS } from "@/lib/hr-settings"
import { getEmployeeSmartFilters, getSmartFilterSeverityStyles } from "@/lib/employee-smart-filters"
import type { EmployeeListItem } from "@/types/employee-profile"

interface EmployeeSmartFiltersPanelProps {
  /** Pre-computed matches from the parent's single computeSmartFilterMatches()
   * pass — this panel never recomputes them, so selecting a card, expanding
   * the section, or re-rendering the list never costs a second traversal. */
  matches: Record<string, EmployeeListItem[]>
  selectedId: string
  onSelect: (id: string) => void
}

/**
 * HR Xəbərdarlıqları (HR Action Center) — dynamic, business-rule-driven HR
 * indicators. Purely a consumer of the Smart Filters registry
 * (employee-smart-filters.ts): every card's icon, color, title, count, and
 * click behavior comes from iterating that registry, never a switch
 * statement here, so a filter registered by a future module shows up with
 * zero changes to this component.
 */
export function EmployeeSmartFiltersPanel({ matches, selectedId, onSelect }: EmployeeSmartFiltersPanelProps) {
  const t = useTranslations("Employees.smartFilters")
  const [expanded, setExpanded] = useState(true)
  const contentId = useId()

  const filters = getEmployeeSmartFilters()

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

          <div
            role="group"
            aria-label={t("sectionTitle")}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {filters.map((filter) => {
              const count = matches[filter.id]?.length ?? 0
              const isActive = selectedId === filter.id
              const isEmpty = count === 0
              const params = filter.messageParams?.(HR_SETTINGS)
              const styles = getSmartFilterSeverityStyles(filter.severity)
              const Icon = filter.icon
              const title = t(filter.titleKey, params)

              return (
                <SmartFilterCard
                  key={filter.id}
                  icon={Icon}
                  emoji={filter.emoji}
                  title={title}
                  description={t(filter.descriptionKey, params)}
                  countLabel={t("employeeCount", { count })}
                  viewLabel={t("viewAction")}
                  activeLabel={t("activeLabel")}
                  isActive={isActive}
                  isEmpty={isEmpty}
                  iconWrapClassName={styles.iconWrap}
                  iconClassName={styles.icon}
                  accentTextClassName={styles.accentText}
                  onClick={() => onSelect(isActive ? "" : filter.id)}
                />
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

interface SmartFilterCardProps {
  icon: LucideIcon
  emoji: string
  title: string
  description: string
  countLabel: string
  viewLabel: string
  activeLabel: string
  isActive: boolean
  isEmpty: boolean
  iconWrapClassName: string
  iconClassName: string
  accentTextClassName: string
  onClick: () => void
}

function SmartFilterCard({
  icon: Icon,
  emoji,
  title,
  description,
  countLabel,
  viewLabel,
  activeLabel,
  isActive,
  isEmpty,
  iconWrapClassName,
  iconClassName,
  accentTextClassName,
  onClick,
}: SmartFilterCardProps) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      aria-label={`${title} — ${countLabel}${isActive ? ` (${activeLabel})` : ""}`}
      title={description}
      onClick={onClick}
      className={cn(
        "group relative flex items-start gap-2.5 rounded-lg border bg-background px-3 py-2.5 text-left shadow-xs outline-none transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50",
        isActive ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border",
        isEmpty && !isActive && "opacity-60"
      )}
    >
      {isActive ? (
        <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <svg viewBox="0 0 12 12" className="size-2.5" fill="none" aria-hidden="true">
            <path d="M2.5 6.5l2.2 2.2L9.5 3.5" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}

      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", iconWrapClassName)}>
        <Icon className={cn("size-4", iconClassName)} strokeWidth={1.75} aria-hidden="true" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1 truncate text-xs font-medium text-foreground">
          <span aria-hidden="true">{emoji}</span>
          <span className="truncate">{title}</span>
        </span>
        <span className={cn("text-sm font-semibold tabular-nums", accentTextClassName)}>{countLabel}</span>
        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {viewLabel}
          <ChevronRight className="size-3" strokeWidth={1.75} />
        </span>
      </span>
    </button>
  )
}
