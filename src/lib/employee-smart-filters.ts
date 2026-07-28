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

export interface SmartFilterDefinition {
  id: string
  /** Key under the Employees.smartFilters translation namespace. */
  titleKey: string
  descriptionKey: string
  icon: LucideIcon
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
    icon: Landmark,
    predicate: (employee, settings, now) =>
      calculateAgeFromDateOfBirth(employee.dateOfBirth, now) >= settings.retirementAge,
  },
  {
    id: "retirementSoon",
    titleKey: "retirementSoon.title",
    descriptionKey: "retirementSoon.description",
    icon: Hourglass,
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
    icon: Cake,
    predicate: (employee, _settings, now) => {
      const dob = parseDate(employee.dateOfBirth)
      return Boolean(dob && dob.getMonth() === now.getMonth())
    },
  },
  {
    id: "missingManager",
    titleKey: "missingManager.title",
    descriptionKey: "missingManager.description",
    icon: UserX,
    predicate: (employee) => !employee.managerId,
  },
  {
    id: "missingDepartment",
    titleKey: "missingDepartment.title",
    descriptionKey: "missingDepartment.description",
    icon: Building2,
    predicate: (employee) => !employee.department?.trim(),
  },
  {
    id: "missingPosition",
    titleKey: "missingPosition.title",
    descriptionKey: "missingPosition.description",
    icon: Building2,
    predicate: (employee) => !employee.position?.trim(),
  },
  {
    id: "longService",
    titleKey: "longService.title",
    descriptionKey: "longService.description",
    icon: Sparkles,
    predicate: (employee, settings, now) =>
      calculateServiceDuration(employee.hireDate, now).years >= settings.longServiceThresholdYears,
    messageParams: (settings) => ({ years: settings.longServiceThresholdYears }),
  },
  {
    id: "recentlyHired",
    titleKey: "recentlyHired.title",
    descriptionKey: "recentlyHired.description",
    icon: UserPlus,
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
    icon: CalendarClock,
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
