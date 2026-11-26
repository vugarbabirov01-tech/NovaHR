// Previous work experience: ƏMAS (official, read-only in Nova) plus work-book
// experience that counts only after HR confirms it. Pure functions, no I/O.
//
// The guarantee: nothing is ever counted twice.
//  - With dated periods, only the days not already covered by an ƏMAS period or
//    by the current contract are added on top of the ƏMAS figure.
//  - With only a declared total, the larger of the two figures is used, never
//    their sum.

import { addDurations, calculateServiceDuration } from "@/lib/employees"
import type { EmployeeProfile, WorkBookPeriod, WorkExperienceDuration } from "@/types/employee-profile"

export const ZERO_DURATION: WorkExperienceDuration = { years: 0, months: 0, days: 0 }

const DAY_MS = 86_400_000

/** For comparing two durations only (30-day months, as ƏMAS normalises them). */
export function durationToDays(d: WorkExperienceDuration): number {
  return d.years * 365 + d.months * 30 + d.days
}

export function sameDuration(a: WorkExperienceDuration | undefined, b: WorkExperienceDuration | undefined): boolean {
  return !!a && !!b && a.years === b.years && a.months === b.months && a.days === b.days
}

const toDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS)

/** Inclusive range of day numbers. */
interface Range {
  from: number
  to: number
}

export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const parsed = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso
}

function merge(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.from - b.from)
  const out: Range[] = []
  for (const range of sorted) {
    const last = out[out.length - 1]
    if (last && range.from <= last.to + 1) last.to = Math.max(last.to, range.to)
    else out.push({ ...range })
  }
  return out
}

/** The parts of `ranges` not covered by `covered`. Both must already be merged. */
function subtract(ranges: Range[], covered: Range[]): Range[] {
  const out: Range[] = []
  for (const range of ranges) {
    let from = range.from
    for (const block of covered) {
      if (block.to < from || block.from > range.to) continue
      if (block.from > from) out.push({ from, to: block.from - 1 })
      from = block.to + 1
    }
    if (from <= range.to) out.push({ from, to: range.to })
  }
  return out
}

const countDays = (ranges: Range[]) => ranges.reduce((sum, r) => sum + r.to - r.from + 1, 0)

/** Calendar length of an inclusive range, in years / months / days (ƏMAS method). */
function rangeDuration({ from, to }: Range): WorkExperienceDuration {
  const start = new Date(from * DAY_MS)
  const end = new Date((to + 1) * DAY_MS)
  let years = end.getUTCFullYear() - start.getUTCFullYear()
  let months = end.getUTCMonth() - start.getUTCMonth()
  let days = end.getUTCDate() - start.getUTCDate()
  if (days < 0) {
    months -= 1
    days += new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0)).getUTCDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  return { years, months, days: Math.max(0, days) }
}

const periodRanges = (periods: { startDate: string; endDate: string }[]): Range[] =>
  merge(
    periods
      .filter((p) => isValidIsoDate(p.startDate) && isValidIsoDate(p.endDate) && p.endDate >= p.startDate)
      .map((p) => ({ from: toDay(p.startDate), to: toDay(p.endDate) }))
  )

export interface PeriodAnalysis {
  /** Experience the work-book periods add on top of what is already counted. */
  added: WorkExperienceDuration
  addedDays: number
  /** Work-book days already covered by an ƏMAS period. */
  overlapEmasDays: number
  /** Work-book days that fall inside the current contract. */
  overlapCurrentDays: number
}

export function analyzeWorkBookPeriods(
  periods: WorkBookPeriod[],
  profile: Pick<EmployeeProfile, "labourLaw" | "employment">,
  asOf: Date = new Date()
): PeriodAnalysis {
  const book = periodRanges(periods)
  const emas = periodRanges((profile.labourLaw.previousEmployments ?? []).filter((job) => job.counted))
  const today = Math.floor(asOf.getTime() / DAY_MS)
  const current = isValidIsoDate(profile.employment.hireDate)
    ? [{ from: toDay(profile.employment.hireDate), to: Math.max(today, toDay(profile.employment.hireDate)) }]
    : []

  const afterEmas = subtract(book, emas)
  const fresh = subtract(afterEmas, current)
  return {
    added: fresh.reduce((sum, range) => addDurations(sum, rangeDuration(range)), ZERO_DURATION),
    addedDays: countDays(fresh),
    overlapEmasDays: countDays(book) - countDays(afterEmas),
    overlapCurrentDays: countDays(afterEmas) - countDays(fresh),
  }
}

/**
 * The ƏMAS figure. Records not yet touched by the ƏMAS import have no separate
 * official value; what they already carry is treated as official.
 */
export function officialExperience(labourLaw: EmployeeProfile["labourLaw"]): WorkExperienceDuration {
  return labourLaw.officialPreviousExperience ?? labourLaw.previousWorkExperience ?? ZERO_DURATION
}

export type ExperienceSource = "official" | "workBookPeriods" | "workBookTotal"

export interface ResolvedExperience {
  official: WorkExperienceDuration
  /** What leave is calculated from. */
  effective: WorkExperienceDuration
  source: ExperienceSource
  periods?: PeriodAnalysis
}

export function resolveExperience(
  profile: Pick<EmployeeProfile, "labourLaw" | "employment">,
  asOf: Date = new Date()
): ResolvedExperience {
  const official = officialExperience(profile.labourLaw)
  const book = profile.labourLaw.workBook
  if (!book || book.status !== "confirmed") return { official, effective: official, source: "official" }

  if (book.periods.length > 0) {
    const periods = analyzeWorkBookPeriods(book.periods, profile, asOf)
    return {
      official,
      effective: periods.addedDays > 0 ? addDurations(official, periods.added) : official,
      source: periods.addedDays > 0 ? "workBookPeriods" : "official",
      periods,
    }
  }

  if (book.declaredTotal && durationToDays(book.declaredTotal) > durationToDays(official)) {
    return { official, effective: book.declaredTotal, source: "workBookTotal" }
  }
  return { official, effective: official, source: "official" }
}

export type ReviewReason = "bothSources" | "likelyDuplicate" | "informalPeriod" | "bookOnly"

/** How close two figures must be to be read as "the same job counted again". */
const DUPLICATE_TOLERANCE_DAYS = 100

/**
 * True when a declared total looks as if it already contains the current job:
 * it (or what it adds to ƏMAS) matches the current tenure, or it matches ƏMAS
 * plus the current tenure. Tenure is measured on the date the total was stated,
 * so the warning does not fade as time passes. A heuristic: it cannot catch
 * every double count.
 */
export function looksLikeCurrentJob(
  profile: Pick<EmployeeProfile, "labourLaw" | "employment">,
  declared: WorkExperienceDuration,
  statedOn: Date
): boolean {
  const official = durationToDays(officialExperience(profile.labourLaw))
  const total = durationToDays(declared)
  const hired = Date.parse(profile.employment.hireDate)
  if (Number.isNaN(hired) || total - official <= 3) return false
  const current = (statedOn.getTime() - hired) / DAY_MS
  // declared = current; declared = ƏMAS + current (which is also "the excess = current").
  return [total - current, total - official - current].some(
    (gap) => Math.abs(gap) <= DUPLICATE_TOLERANCE_DAYS
  )
}

/** Why a declared work-book total deserves a closer look. */
export function reviewReasons(
  profile: Pick<EmployeeProfile, "labourLaw" | "employment">,
  asOf: Date = new Date()
): ReviewReason[] {
  const book = profile.labourLaw.workBook
  const declared = book?.declaredTotal
  if (!declared) return []
  const official = officialExperience(profile.labourLaw)
  const extra = durationToDays(declared) - durationToDays(official)
  if (extra <= 3) return []

  const reasons: ReviewReason[] = [durationToDays(official) > 0 ? "bothSources" : "bookOnly"]
  const statedOn = book.declaredAsOf ? new Date(`${book.declaredAsOf}T00:00:00Z`) : asOf
  if (looksLikeCurrentJob(profile, declared, statedOn)) reasons.push("likelyDuplicate")
  const { hireDate, actualStartDate } = profile.employment
  const hired = Date.parse(hireDate)
  if (!Number.isNaN(hired) && actualStartDate) {
    const started = Date.parse(actualStartDate.length === 4 ? `${actualStartDate}-01-01` : actualStartDate)
    const gap = (hired - started) / DAY_MS
    if (gap > 90 && Math.abs(extra - gap) <= 120) reasons.push("informalPeriod")
  }
  return reasons
}

/**
 * For lists and reports ("who has been here longest"): the recorded actual start,
 * or the official hire date when nothing earlier is recorded.
 */
export function companyStart(employment: {
  hireDate: string
  actualStartDate?: string
}): { date: string; approximate: boolean } | undefined {
  const actual = employment.actualStartDate
  if (actual) {
    const approximate = /^\d{4}$/.test(actual)
    const date = approximate ? `${actual}-01-01` : actual
    // A year-only start in the hire year says nothing more than the hire date does.
    if (isValidIsoDate(date) && !(approximate && employment.hireDate?.startsWith(actual))) {
      return { date, approximate }
    }
  }
  return isValidIsoDate(employment.hireDate) ? { date: employment.hireDate, approximate: false } : undefined
}

/**
 * Tenure at this company counted from when the person actually started, which
 * may be earlier than the official hire date. Company information and reports
 * only: nothing about leave or pay reads it. A year-only start is counted from
 * 1 January and marked approximate. Undefined when no actual start is recorded.
 */
export function actualCompanyService(
  employment: Pick<EmployeeProfile["employment"], "actualStartDate">,
  asOf: Date = new Date()
): { duration: WorkExperienceDuration; approximate: boolean } | undefined {
  const start = employment.actualStartDate
  if (!start) return undefined
  const approximate = /^\d{4}$/.test(start)
  const iso = approximate ? `${start}-01-01` : start
  if (!isValidIsoDate(iso)) return undefined
  return { duration: calculateServiceDuration(iso, asOf), approximate }
}

/**
 * Keeps the experience fields out of reach of ordinary employee edits and
 * imports: whatever the incoming record says, the ƏMAS and work-book data stay
 * as stored and the effective figure is derived again (the hire date may have
 * changed).
 */
export function protectExperience(existing: EmployeeProfile, incoming: EmployeeProfile): EmployeeProfile {
  const merged: EmployeeProfile = {
    ...incoming,
    employment: { ...incoming.employment, actualStartDate: existing.employment.actualStartDate },
    labourLaw: {
      ...incoming.labourLaw,
      officialPreviousExperience: existing.labourLaw.officialPreviousExperience,
      workBook: existing.labourLaw.workBook,
      previousEmployments: existing.labourLaw.previousEmployments,
      previousWorkExperience: existing.labourLaw.previousWorkExperience,
    },
  }
  if (merged.labourLaw.officialPreviousExperience) {
    merged.labourLaw.previousWorkExperience = resolveExperience(merged).effective
  }
  return merged
}

/** A record created inside Nova has no ƏMAS experience until the next import. */
export function startWithoutExperience(profile: EmployeeProfile): EmployeeProfile {
  return {
    ...profile,
    labourLaw: {
      ...profile.labourLaw,
      officialPreviousExperience: ZERO_DURATION,
      workBook: undefined,
      previousEmployments: undefined,
      previousWorkExperience: ZERO_DURATION,
    },
  }
}
