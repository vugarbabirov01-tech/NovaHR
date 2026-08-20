/**
 * The leave entitlement/work-year period — e.g. "2025–2026" — a request
 * draws its balance from. HR selects this explicitly; it is NEVER derived
 * from the request's own startDate, because an employee can legitimately
 * use a prior year's remaining balance for leave taken well into the
 * following year (see LeaveRequest.leavePeriodStartYear's own schema
 * comment). This module only formats/enumerates periods for the picker —
 * it has no opinion on which one is "correct" for a given request.
 */
export interface LeavePeriodOption {
  startYear: number
  label: string
}

/** "{startYear}–{startYear + 1}" — an en dash, matching how this is written
 * everywhere else in the product (HR terminology, not a hyphenated range). */
export function formatLeavePeriod(startYear: number): string {
  return `${startYear}–${startYear + 1}`
}

/** Number of past periods shown, counting the current one — e.g. for 2026
 * that's 2022–2023, 2023–2024, 2024–2025, 2025–2026, 2026–2027 (4 prior +
 * the current period). Kept as a named constant, not an inline literal, so
 * the "5 previous/current periods" rule is a single number to change if it
 * ever needs to, not a magic offset buried in the range math below. */
const PAST_AND_CURRENT_PERIOD_COUNT = 5

/** Number of periods shown beyond the current one — just next year's, per
 * the same reasoning as PAST_AND_CURRENT_PERIOD_COUNT above. */
const UPCOMING_PERIOD_COUNT = 1

/** A window computed fresh from `asOfDate`'s year every call — never a
 * fixed/hardcoded set of years, so the list shifts forward on its own every
 * January without this file changing. Always PAST_AND_CURRENT_PERIOD_COUNT
 * consecutive periods ending at the current year's, plus
 * UPCOMING_PERIOD_COUNT more beyond it, oldest first. */
export function generateLeavePeriodOptions(asOfDate: Date = new Date()): LeavePeriodOption[] {
  const currentYear = asOfDate.getFullYear()
  const firstStartYear = currentYear - (PAST_AND_CURRENT_PERIOD_COUNT - 1)
  const lastStartYear = currentYear + UPCOMING_PERIOD_COUNT
  const startYears: number[] = []
  for (let startYear = firstStartYear; startYear <= lastStartYear; startYear++) {
    startYears.push(startYear)
  }
  return startYears.map((startYear) => ({ startYear, label: formatLeavePeriod(startYear) }))
}
