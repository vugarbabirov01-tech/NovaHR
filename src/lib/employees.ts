import type {
  ContractType,
  EmployeeListItem,
  EmploymentStatus,
  EmploymentType,
  Gender,
  WorkExperienceDuration,
  WorkLocationType,
} from "@/types/employee-profile"

// Azerbaijan's statutory pension age reform phased in gradually: men reached
// 65 by 1 July 2021, women reach 65 by 1 July 2027. Both are effectively 65
// at this application's current date. Revisit these constants if the
// legislated schedule changes.
const RETIREMENT_AGE_MALE = 65
const RETIREMENT_AGE_FEMALE = 65

export function calculateAgeFromDateOfBirth(dateOfBirth: string, asOf: Date = new Date()): number {
  if (!dateOfBirth) return 0
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return 0
  let age = asOf.getFullYear() - dob.getFullYear()
  const monthDiff = asOf.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
    age -= 1
  }
  return Math.max(age, 0)
}

/** Derived, never stored — always computed from Personal step's dateOfBirth. */
export function isMinorFromDateOfBirth(dateOfBirth: string): boolean {
  if (!dateOfBirth) return false
  return calculateAgeFromDateOfBirth(dateOfBirth) < 18
}

/** Derived, never stored — always computed from dateOfBirth + gender. */
export function isRetirementAgeFromDateOfBirth(dateOfBirth: string, gender: Gender | ""): boolean {
  if (!dateOfBirth || !gender) return false
  const threshold = gender === "male" ? RETIREMENT_AGE_MALE : RETIREMENT_AGE_FEMALE
  return calculateAgeFromDateOfBirth(dateOfBirth) >= threshold
}

/**
 * "Company Service Duration" — derived, never stored. A calendar-accurate
 * years/months/days walk from the employee's hire date to now (or another
 * reference date), respecting real month lengths rather than a fixed-day
 * approximation.
 */
export function calculateServiceDuration(hireDate: string, asOf: Date = new Date()): WorkExperienceDuration {
  if (!hireDate) return { years: 0, months: 0, days: 0 }
  const start = new Date(hireDate)
  if (Number.isNaN(start.getTime()) || start > asOf) return { years: 0, months: 0, days: 0 }

  let years = asOf.getFullYear() - start.getFullYear()
  let months = asOf.getMonth() - start.getMonth()
  let days = asOf.getDate() - start.getDate()

  if (days < 0) {
    months -= 1
    const daysInPreviousMonth = new Date(asOf.getFullYear(), asOf.getMonth(), 0).getDate()
    days += daysInPreviousMonth
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  return { years, months, days }
}

/**
 * Sums two durations for "Total Work Experience" (Previous Work Experience +
 * Company Service Duration). Normalizes on the conventional 30-days-per-month,
 * 12-months-per-year basis used for HR experience totals — distinct from
 * calculateServiceDuration's calendar-accurate walk, since this is combining
 * an HR-entered estimate with a calendar-derived duration, not deriving from
 * two real dates.
 */
export function addDurations(a: WorkExperienceDuration, b: WorkExperienceDuration): WorkExperienceDuration {
  let days = a.days + b.days
  let months = a.months + b.months
  let years = a.years + b.years

  if (days >= 30) {
    months += Math.floor(days / 30)
    days %= 30
  }
  if (months >= 12) {
    years += Math.floor(months / 12)
    months %= 12
  }
  return { years, months, days }
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
}

export function getFullName(item: Pick<EmployeeListItem, "firstName" | "lastName">) {
  return `${item.firstName} ${item.lastName}`
}

const AUTO_EMPLOYEE_NUMBER_PATTERN = /^EMP-(\d+)$/i

/**
 * Continues the `EMP-######` sequence from the highest existing number of
 * that shape — manually entered numbers in other formats (e.g. `CLN-2026-001`)
 * are ignored for sequencing purposes but still occupy the uniqueness space
 * checked by `isEmployeeNumberTaken`. Takes plain strings rather than reading
 * the data layer directly, so the same logic can be reused by a future bulk
 * import without depending on how/where employees are stored.
 */
export function generateNextEmployeeNumber(existingEmployeeNumbers: string[]): string {
  const highest = existingEmployeeNumbers.reduce((max, value) => {
    const match = AUTO_EMPLOYEE_NUMBER_PATTERN.exec(value.trim())
    if (!match) return max
    const numeric = Number(match[1])
    return numeric > max ? numeric : max
  }, 0)
  return `EMP-${String(highest + 1).padStart(6, "0")}`
}

export function isEmployeeNumberTaken(
  employeeNumber: string,
  existingEmployeeNumbers: string[],
  excludeEmployeeNumber?: string
): boolean {
  const normalized = employeeNumber.trim()
  const excluded = excludeEmployeeNumber?.trim()
  return existingEmployeeNumbers.some((value) => value.trim() === normalized && value.trim() !== excluded)
}

// Employment Status only — active/probation/suspended/terminated/inactive.
// "on-leave" and "business-trip" used to live in these lookups; they were
// WorkStatus values masquerading as EmploymentStatus ones. That live,
// day-to-day status now comes exclusively from resolveWorkStatus
// (src/lib/employee-work-status.ts) + WorkStatusBadge — never from here.
export const statusToneClassName: Record<EmployeeListItem["employmentStatus"], string> = {
  active: "bg-status-good",
  probation: "bg-status-warning",
  suspended: "bg-status-serious",
  terminated: "bg-status-critical",
  inactive: "bg-muted-foreground",
}

export const statusTextClassName: Record<EmployeeListItem["employmentStatus"], string> = {
  active: "text-status-good",
  probation: "text-amber-700",
  suspended: "text-orange-700",
  terminated: "text-status-critical",
  inactive: "text-muted-foreground",
}

export const statusMessageKeys: Record<
  EmploymentStatus,
  "active" | "probation" | "suspended" | "terminated" | "inactive"
> = {
  active: "active",
  probation: "probation",
  suspended: "suspended",
  terminated: "terminated",
  inactive: "inactive",
}

export const employmentTypeMessageKeys: Record<
  EmploymentType,
  "fullTime" | "partTime" | "seasonal" | "temporary" | "contract" | "internship"
> = {
  "full-time": "fullTime",
  "part-time": "partTime",
  seasonal: "seasonal",
  temporary: "temporary",
  contract: "contract",
  internship: "internship",
}

export const contractTypeMessageKeys: Record<
  ContractType,
  "permanent" | "fixedTerm" | "projectBased" | "internship"
> = {
  permanent: "permanent",
  "fixed-term": "fixedTerm",
  "project-based": "projectBased",
  internship: "internship",
}

export const workLocationTypeMessageKeys: Record<
  WorkLocationType,
  "onSite" | "remote" | "hybrid"
> = {
  "on-site": "onSite",
  remote: "remote",
  hybrid: "hybrid",
}

export function countBy<T>(items: T[], selector: (item: T) => string | undefined): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    const key = selector(item)
    if (!key) continue
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

