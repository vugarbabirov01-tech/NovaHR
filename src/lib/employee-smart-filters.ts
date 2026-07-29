// Smart Filters — dynamic, business-rule-driven employee views, distinct from
// the Employee module's manual filters (Search, Status, Advanced Filters).
//
// This is a general-purpose registry, not an Employee-only concept: any
// future module (Leave, Payroll, Performance, Training, ...) can append its
// own Smart Filters via registerEmployeeSmartFilter without this file, the
// Employee List page, or any existing filter being touched. The registry is
// intentionally a flat array of small declarative objects — no switch
// statement anywhere decides "which filter is which"; the UI only ever
// iterates the registry and calls each definition's own predicate.
//
// Every threshold a predicate needs (retirement age, long-service years,
// probation/hire windows) comes from HR_SETTINGS — see hr-settings.ts —
// never a literal number in this file.

import {
  Building2,
  Cake,
  CalendarClock,
  Hourglass,
  Landmark,
  Sparkles,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react"

import { calculateAgeFromDateOfBirth, calculateServiceDuration } from "@/lib/employees"
import { HR_SETTINGS, type HrSettings } from "@/lib/hr-settings"
import type { EmployeeListItem } from "@/types/employee-profile"

/**
 * How urgently a Smart Filter's matches need HR's attention — the single
 * source of truth for every color/tone decision the HR Action Center makes
 * (status card, active employee badge, etc). Nothing downstream picks a
 * color by filter id; everything reads this field instead.
 */
export type SmartFilterSeverity = "critical" | "warning" | "info" | "success"

export interface SmartFilterDefinition {
  id: string
  /** Key under the Employees.smartFilters translation namespace. */
  titleKey: string
  descriptionKey: string
  /** Key for the short label shown on an employee's temporary Smart Filter
   * badge (e.g. "Ad günü" vs. the fuller chip title "Ad günü bu ay"). */
  badgeKey: string
  icon: LucideIcon
  /** Single emoji surfaced on status cards and employee badges. */
  emoji: string
  severity: SmartFilterSeverity
  predicate: (employee: EmployeeListItem, settings: HrSettings, now: Date) => boolean
  /** ICU params (e.g. {years}, {days}) the title/description interpolate —
   * always derived from settings, so the threshold is never baked into a
   * translated string either. */
  messageParams?: (settings: HrSettings) => Record<string, number>
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getRetirementDate(dateOfBirth: string, retirementAge: number): Date | null {
  const dob = parseDate(dateOfBirth)
  if (!dob) return null
  const retirementDate = new Date(dob)
  retirementDate.setFullYear(retirementDate.getFullYear() + retirementAge)
  return retirementDate
}

const builtInSmartFilters: SmartFilterDefinition[] = [
  {
    id: "retirement",
    titleKey: "retirement.title",
    descriptionKey: "retirement.description",
    badgeKey: "retirement.badge",
    icon: Landmark,
    emoji: "🧓",
    severity: "warning",
    predicate: (employee, settings, now) =>
      calculateAgeFromDateOfBirth(employee.dateOfBirth, now) >= settings.retirementAge,
  },
  {
    id: "retirementSoon",
    titleKey: "retirementSoon.title",
    descriptionKey: "retirementSoon.description",
    badgeKey: "retirementSoon.badge",
    icon: Hourglass,
    emoji: "🧓",
    severity: "warning",
    predicate: (employee, settings, now) => {
      const retirementDate = getRetirementDate(employee.dateOfBirth, settings.retirementAge)
      if (!retirementDate) return false
      const windowEnd = addMonths(now, settings.retirementWithinMonths)
      return retirementDate > now && retirementDate <= windowEnd
    },
    messageParams: (settings) => ({ months: settings.retirementWithinMonths }),
  },
  {
    id: "birthdaysThisMonth",
    titleKey: "birthdaysThisMonth.title",
    descriptionKey: "birthdaysThisMonth.description",
    badgeKey: "birthdaysThisMonth.badge",
    icon: Cake,
    emoji: "🎂",
    severity: "info",
    predicate: (employee, _settings, now) => {
      const dob = parseDate(employee.dateOfBirth)
      return Boolean(dob && dob.getMonth() === now.getMonth())
    },
  },
  {
    id: "missingManager",
    titleKey: "missingManager.title",
    descriptionKey: "missingManager.description",
    badgeKey: "missingManager.badge",
    icon: UserX,
    emoji: "⚠️",
    severity: "critical",
    predicate: (employee) => !employee.managerId,
  },
  {
    id: "missingDepartment",
    titleKey: "missingDepartment.title",
    descriptionKey: "missingDepartment.description",
    badgeKey: "missingDepartment.badge",
    icon: Building2,
    emoji: "⚠️",
    severity: "critical",
    predicate: (employee) => !employee.department?.trim(),
  },
  {
    id: "missingPosition",
    titleKey: "missingPosition.title",
    descriptionKey: "missingPosition.description",
    badgeKey: "missingPosition.badge",
    icon: Building2,
    emoji: "⚠️",
    severity: "critical",
    predicate: (employee) => !employee.position?.trim(),
  },
  {
    id: "longService",
    titleKey: "longService.title",
    descriptionKey: "longService.description",
    badgeKey: "longService.badge",
    icon: Sparkles,
    emoji: "⭐",
    severity: "info",
    predicate: (employee, settings, now) =>
      calculateServiceDuration(employee.hireDate, now).years >= settings.longServiceThresholdYears,
    messageParams: (settings) => ({ years: settings.longServiceThresholdYears }),
  },
  {
    id: "recentlyHired",
    titleKey: "recentlyHired.title",
    descriptionKey: "recentlyHired.description",
    badgeKey: "recentlyHired.badge",
    icon: UserPlus,
    emoji: "🏖️",
    severity: "info",
    predicate: (employee, settings, now) => {
      const hireDate = parseDate(employee.hireDate)
      if (!hireDate || hireDate > now) return false
      const windowStart = addDays(now, -settings.recentlyHiredDays)
      return hireDate >= windowStart
    },
    messageParams: (settings) => ({ days: settings.recentlyHiredDays }),
  },
  {
    id: "probationEndingSoon",
    titleKey: "probationEndingSoon.title",
    descriptionKey: "probationEndingSoon.description",
    badgeKey: "probationEndingSoon.badge",
    icon: CalendarClock,
    emoji: "⏳",
    severity: "warning",
    predicate: (employee, settings, now) => {
      const end = parseDate(employee.probationEndDate)
      if (!end) return false
      const windowEnd = addDays(now, settings.probationWarningDays)
      return end >= now && end <= windowEnd
    },
    messageParams: (settings) => ({ days: settings.probationWarningDays }),
  },
]

/**
 * The live registry. Phase 1 seeds it with the built-ins above; future
 * modules extend it at import time via registerEmployeeSmartFilter — the
 * Employee List page always reads the current contents through
 * getEmployeeSmartFilters, so anything registered later just appears.
 */
const registry: SmartFilterDefinition[] = [...builtInSmartFilters]

export function registerEmployeeSmartFilter(filter: SmartFilterDefinition): void {
  if (registry.some((existing) => existing.id === filter.id)) {
    throw new Error(`A Smart Filter with id "${filter.id}" is already registered.`)
  }
  registry.push(filter)
}

export function getEmployeeSmartFilters(): readonly SmartFilterDefinition[] {
  return registry
}

/**
 * Computes every registered filter's matches in a single pass over
 * `employees` — the cost is one array traversal regardless of how many
 * Smart Filters are registered, rather than one traversal per filter. The
 * returned matches double as the ready-to-use filtered list for whichever
 * filter gets selected, so selecting one never needs a second pass either.
 */
export function computeSmartFilterMatches(
  employees: EmployeeListItem[],
  settings: HrSettings = HR_SETTINGS,
  now: Date = new Date()
): Record<string, EmployeeListItem[]> {
  const filters = getEmployeeSmartFilters()
  const results: Record<string, EmployeeListItem[]> = {}
  for (const filter of filters) results[filter.id] = []

  for (const employee of employees) {
    for (const filter of filters) {
      if (filter.predicate(employee, settings, now)) {
        results[filter.id].push(employee)
      }
    }
  }

  return results
}

/**
 * Severity → styling, resolved in exactly one place so the HR Action Center
 * cards and an employee's temporary Smart Filter badge always agree on what
 * "critical" vs. "warning" looks like — neither reimplements the mapping.
 */
export interface SmartFilterSeverityStyles {
  /** Status-card icon chip (rounded square behind the Lucide icon). */
  iconWrap: string
  /** Status-card icon color. */
  icon: string
  /** Status-card left accent + count color. */
  accentText: string
  /** Employee-card temporary badge. */
  badge: string
}

const severityStyles: Record<SmartFilterSeverity, SmartFilterSeverityStyles> = {
  critical: {
    iconWrap: "bg-status-critical/10",
    icon: "text-status-critical",
    accentText: "text-status-critical",
    badge: "border-status-critical/20 bg-status-critical/10 text-status-critical",
  },
  warning: {
    iconWrap: "bg-amber-500/10",
    icon: "text-amber-600",
    accentText: "text-amber-600",
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-700",
  },
  info: {
    iconWrap: "bg-sky-500/10",
    icon: "text-sky-600",
    accentText: "text-sky-600",
    badge: "border-sky-500/20 bg-sky-500/10 text-sky-700",
  },
  success: {
    iconWrap: "bg-status-good/10",
    icon: "text-status-good",
    accentText: "text-status-good",
    badge: "border-status-good/20 bg-status-good/10 text-status-good",
  },
}

export function getSmartFilterSeverityStyles(severity: SmartFilterSeverity): SmartFilterSeverityStyles {
  return severityStyles[severity]
}
