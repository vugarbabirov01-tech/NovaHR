import {
  addDurations,
  calculateAgeFromDateOfBirth,
  calculateServiceDuration,
  isMinorFromDateOfBirth,
} from "@/lib/employees"
import { findActiveWorkSchedules } from "@/repositories/work-schedule-repository"
import { findHolidaysBetween } from "@/repositories/holiday-repository"
import { LEAVE_SETTINGS } from "@/lib/leave-settings"
import { AZ_LABOUR_CODE_LEAVE_RULES, TEACHER_COACH_LEAVE_GAP_NOTE } from "@/lib/leave/leave-labour-code-rules"
import type { EmployeeProfile } from "@/types/employee-profile"

/**
 * Leave Policy Resolution Engine — the single source of truth for every
 * leave entitlement, eligibility, and date calculation in Nova HRMS. No
 * other module (Employee Profile, Leave Request, Calendar, Payroll,
 * Termination, Dashboard) may implement these rules independently; they
 * all import from this file.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000
// Index matches JS Date.getDay() (0 = Sunday .. 6 = Saturday).
const WEEKDAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toDateOnlyIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseWorkingDays(workingDays: string): Set<number> {
  const set = new Set<number>()
  for (const raw of workingDays.split(",")) {
    const idx = WEEKDAY_CODES.indexOf(raw.trim().toUpperCase() as (typeof WEEKDAY_CODES)[number])
    if (idx >= 0) set.add(idx)
  }
  return set
}

// ---------------------------------------------------------------------------
// Annual Leave Entitlement (Art. 112-120)
// ---------------------------------------------------------------------------

export interface EntitlementComponent {
  /** "statutory" = a Labour Code article; "company" = a non-statutory,
   * employer-granted addition; "gap" = a rule this engine cannot reliably
   * evaluate with current data (contributes 0 days, never silently folded
   * into the total). */
  source: "statutory" | "company" | "gap"
  article: string
  days: number
  description: string
}

export interface AnnualLeaveEntitlementResult {
  employeeId: string
  asOfDate: string
  totalDays: number
  unit: "DAYS"
  /** Full breakdown — auditable, not a black box. Every day in totalDays
   * traces back to exactly one component here. */
  components: EntitlementComponent[]
}

const EXTENDED_BASE_PROFESSIONAL_CATEGORIES = new Set([
  "civilServant",
  "judge",
  "prosecutor",
  "academicStaff",
  "medicalStaff",
])

/**
 * Resolves total annual leave entitlement, implementing the Labour Code's
 * non-stacking rule: an employee qualifying for a special-status base
 * (minor, disabled, special-service) gets that figure INSTEAD OF the
 * generic base + hazardous-work/length-of-service additions, not on top of
 * them — those two categories are mutually exclusive per the legal
 * research. Art. 117 (women with children) and company/collective-
 * agreement additions remain additive regardless of which base applies.
 */
export function resolveAnnualLeaveEntitlement(
  profile: EmployeeProfile,
  asOfDate: Date = new Date()
): AnnualLeaveEntitlementResult {
  const { personal, employment, labourLaw } = profile
  const components: EntitlementComponent[] = []
  let usesSpecialStatusBase = false

  const isMinor = isMinorFromDateOfBirth(personal.dateOfBirth)
  const age = calculateAgeFromDateOfBirth(personal.dateOfBirth, asOfDate)

  if (isMinor) {
    const days = age < 16 ? AZ_LABOUR_CODE_LEAVE_RULES.MINOR_LEAVE_DAYS.under16 : AZ_LABOUR_CODE_LEAVE_RULES.MINOR_LEAVE_DAYS.age16to18
    components.push({
      source: "statutory",
      article: "Art. 119.1",
      days,
      description: age < 16 ? "Employee under 16" : "Employee aged 16-18",
    })
    usesSpecialStatusBase = true
  } else if (labourLaw.hasDisability) {
    components.push({
      source: "statutory",
      article: "Art. 119.2",
      days: AZ_LABOUR_CODE_LEAVE_RULES.DISABLED_EMPLOYEE_LEAVE_DAYS,
      description: "Disabled employee (any group/cause/duration)",
    })
    usesSpecialStatusBase = true
  } else if (labourLaw.veteranStatus || labourLaw.stateDecorationName) {
    components.push({
      source: "statutory",
      article: "Art. 120",
      days: AZ_LABOUR_CODE_LEAVE_RULES.SPECIAL_SERVICE_LEAVE_DAYS,
      description: `Special service status: ${labourLaw.veteranStatus ?? labourLaw.stateDecorationName}`,
    })
    usesSpecialStatusBase = true
  } else {
    const isExtended = labourLaw.professionalCategory
      ? EXTENDED_BASE_PROFESSIONAL_CATEGORIES.has(labourLaw.professionalCategory)
      : false
    components.push({
      source: "statutory",
      article: isExtended ? "Art. 114.3" : "Art. 114.2",
      days: isExtended
        ? AZ_LABOUR_CODE_LEAVE_RULES.EXTENDED_BASE_ANNUAL_LEAVE_DAYS
        : AZ_LABOUR_CODE_LEAVE_RULES.BASE_ANNUAL_LEAVE_DAYS,
      description: isExtended
        ? `Extended base leave (${labourLaw.professionalCategory})`
        : "Standard base leave",
    })
    if (labourLaw.professionalCategory === "academicStaff") {
      components.push({ source: "gap", article: "Art. 118", days: 0, description: TEACHER_COACH_LEAVE_GAP_NOTE })
    }
  }

  // Hazardous work and length-of-service additions only stack on the
  // generic base — a special-status base already accounts for them.
  if (!usesSpecialStatusBase) {
    if (labourLaw.hazardousWork || labourLaw.undergroundWork) {
      components.push({
        source: "statutory",
        article: "Art. 115",
        days: AZ_LABOUR_CODE_LEAVE_RULES.HAZARDOUS_WORK_MIN_DAYS,
        description: "Hazardous/underground work (statutory minimum)",
      })
    }

    const companyService = calculateServiceDuration(employment.hireDate, asOfDate)
    const totalService = addDurations(companyService, labourLaw.previousWorkExperience)
    const tier = [...AZ_LABOUR_CODE_LEAVE_RULES.SERVICE_LEAVE_TIERS]
      .reverse()
      .find((t) => totalService.years >= t.minYears)
    if (tier) {
      components.push({
        source: "statutory",
        article: "Art. 116",
        days: tier.days,
        description: `${totalService.years} years combined service (current + prior employers)`,
      })
    }
  }

  // Art. 117 — additive regardless of base.
  if (personal.gender === "female" && labourLaw.children.length > 0) {
    const rule = AZ_LABOUR_CODE_LEAVE_RULES.WOMEN_WITH_CHILDREN
    const under14Count = labourLaw.children.filter(
      (child) => calculateAgeFromDateOfBirth(child.dateOfBirth, asOfDate) < rule.childAgeThresholdYears
    ).length
    const hasDisabledChildUnder16 = labourLaw.children.some(
      (child) => child.hasDisability && calculateAgeFromDateOfBirth(child.dateOfBirth, asOfDate) < rule.disabledChildAgeThresholdYears
    )
    if (under14Count >= 3 || hasDisabledChildUnder16) {
      components.push({
        source: "statutory",
        article: "Art. 117",
        days: rule.threeOrMoreUnder14OrDisabledChildDays,
        description: "3+ children under 14, or a disabled child under 16",
      })
    } else if (under14Count >= 2) {
      components.push({
        source: "statutory",
        article: "Art. 117",
        days: rule.twoChildrenUnder14Days,
        description: "2 children under 14",
      })
    }
  }

  // Non-statutory additions — always additive.
  if (labourLaw.hasCollectiveAgreementLeave && labourLaw.collectiveAgreementLeaveDays) {
    components.push({
      source: "company",
      article: "Collective Agreement",
      days: labourLaw.collectiveAgreementLeaveDays,
      description: "Collective agreement leave",
    })
  }
  if (labourLaw.companyAdditionalLeaveDays > 0) {
    components.push({
      source: "company",
      article: "Company Policy",
      days: labourLaw.companyAdditionalLeaveDays,
      description: "Company-granted additional leave",
    })
  }
  if (labourLaw.manualLeaveAdjustmentDays) {
    components.push({
      source: "company",
      article: "Manual Adjustment",
      days: labourLaw.manualLeaveAdjustmentDays,
      description: "HR manual adjustment",
    })
  }

  const totalDays = components.filter((c) => c.source !== "gap").reduce((sum, c) => sum + c.days, 0)

  return { employeeId: profile.id, asOfDate: toDateOnlyIso(asOfDate), totalDays, unit: "DAYS", components }
}

// ---------------------------------------------------------------------------
// First-Year Eligibility (Art. 131, Art. 119 minor exception)
// ---------------------------------------------------------------------------

export interface LeaveEligibilityResult {
  isEligible: boolean
  /** Never a block — HR always decides. True only when isEligible is false
   * and the minor exception doesn't apply. */
  requiresWarning: boolean
  isMinorException: boolean
  employmentDate: string
  eligibilityDate: string
  remainingDays: number
  ruleReference: string
}

/**
 * Art. 131's 6-month first-year gate. Deliberately returns structured data
 * only — no free-text message. This codebase is i18n'd throughout
 * (az/en/ru); a hardcoded sentence here would bypass that. The Leave
 * Request module renders the actual warning copy from these fields.
 */
export function resolveLeaveEligibility(
  profile: EmployeeProfile,
  asOfDate: Date = new Date()
): LeaveEligibilityResult {
  const isMinor = isMinorFromDateOfBirth(profile.personal.dateOfBirth)
  const hireDate = startOfDay(new Date(profile.employment.hireDate))
  const eligibilityDate = new Date(hireDate)
  eligibilityDate.setMonth(eligibilityDate.getMonth() + AZ_LABOUR_CODE_LEAVE_RULES.FIRST_YEAR_ELIGIBILITY_MONTHS)

  if (isMinor) {
    return {
      isEligible: true,
      requiresWarning: false,
      isMinorException: true,
      employmentDate: profile.employment.hireDate,
      eligibilityDate: toDateOnlyIso(eligibilityDate),
      remainingDays: 0,
      ruleReference: "Art. 119 (minor exception — the Art. 131 6-month wait does not apply)",
    }
  }

  const isEligible = startOfDay(asOfDate) >= eligibilityDate
  const remainingDays = isEligible
    ? 0
    : Math.ceil((eligibilityDate.getTime() - startOfDay(asOfDate).getTime()) / MS_PER_DAY)

  return {
    isEligible,
    requiresWarning: !isEligible,
    isMinorException: false,
    employmentDate: profile.employment.hireDate,
    eligibilityDate: toDateOnlyIso(eligibilityDate),
    remainingDays,
    ruleReference: "Art. 131",
  }
}

// ---------------------------------------------------------------------------
// Working Schedule / Public Holiday / Return-to-Work (Art. 114.6)
// ---------------------------------------------------------------------------

export interface WorkingDayContext {
  /** EmployeeEmployment.workSchedule — free text, resolved by label match
   * against real WorkSchedule rows, the same approach
   * employee-wizard-mapper.ts already uses. */
  workScheduleLabel?: string
  companyId?: string
  branchId?: string
}

/** Never assumes Mon-Fri. Resolves the employee's actual WorkSchedule (by
 * label match) and reads its structured pattern — WEEKLY (a weekday set)
 * or ROTATING (an on/off day-count cycle anchored to a real date). Falls
 * back to LEAVE_SETTINGS.defaultWorkingDays only when the schedule is
 * genuinely free-text/custom and doesn't match any real WorkSchedule row. */
async function resolveWorkingDayPredicate(workScheduleLabel?: string): Promise<(date: Date) => boolean> {
  const schedule = workScheduleLabel
    ? (await findActiveWorkSchedules()).find((s) => s.label === workScheduleLabel)
    : undefined

  if (!schedule) {
    const fallback = parseWorkingDays(LEAVE_SETTINGS.defaultWorkingDays)
    return (date: Date) => fallback.has(date.getDay())
  }

  if (schedule.scheduleType === "ROTATING" && schedule.rotationOnDays && schedule.rotationOffDays && schedule.rotationStartDate) {
    const cycleLength = schedule.rotationOnDays + schedule.rotationOffDays
    const anchor = startOfDay(schedule.rotationStartDate)
    const onDays = schedule.rotationOnDays
    return (date: Date) => {
      const diffDays = Math.floor((startOfDay(date).getTime() - anchor.getTime()) / MS_PER_DAY)
      const cyclePos = ((diffDays % cycleLength) + cycleLength) % cycleLength
      return cyclePos < onDays
    }
  }

  const workingDaySet = parseWorkingDays(schedule.workingDays)
  return (date: Date) => workingDaySet.has(date.getDay())
}

async function fetchHolidayDateSet(from: Date, to: Date, context: WorkingDayContext): Promise<Set<string>> {
  const holidays = await findHolidaysBetween(from, to)
  const scoped = holidays.filter(
    (h) => (!h.companyId || h.companyId === context.companyId) && (!h.branchId || h.branchId === context.branchId)
  )
  return new Set(scoped.map((h) => toDateOnlyIso(h.date)))
}

export async function isWorkingDay(date: Date, context: WorkingDayContext): Promise<boolean> {
  const predicate = await resolveWorkingDayPredicate(context.workScheduleLabel)
  return predicate(date)
}

export async function isHoliday(date: Date, context: WorkingDayContext): Promise<boolean> {
  const day = startOfDay(date)
  const holidaySet = await fetchHolidayDateSet(day, day, context)
  return holidaySet.has(toDateOnlyIso(day))
}

export interface StartDateWarning {
  isHoliday: boolean
  isNonWorkingDay: boolean
}

export interface ReturnToWorkResult {
  startDate: string
  requestedDays: number
  /** "End Date" — the last day of leave, always calculated. */
  lastLeaveDay: string
  /** Always calculated — never entered manually. */
  returnToWorkDate: string
  calendarDays: number
  workingDaysInRange: number
  weekendDaysInRange: number
  /** ISO dates of every holiday inside [startDate, lastLeaveDay] — each one
   * extended the period per Art. 114.6, none reduced the leave balance. */
  holidaysInRange: string[]
  returnDateAdjusted: boolean
  adjustmentReasons: ("holiday" | "non-working-day")[]
  /** Non-blocking — set when the requested startDate itself isn't a working
   * day for this employee's schedule. HR is informed, never stopped. */
  startDateWarning: StartDateWarning | null
}

/**
 * Art. 114.6 + the employee's Working Schedule. HR enters only startDate
 * and numberOfDays; every other field here is derived. A day-by-day walk,
 * not a single range lookup — that's what makes chained adjustments (a
 * holiday immediately followed by a weekend, or multiple consecutive
 * holidays) compose correctly instead of undercounting.
 */
export async function calculateReturnToWork(
  startDate: Date,
  numberOfDays: number,
  context: WorkingDayContext
): Promise<ReturnToWorkResult> {
  const start = startOfDay(startDate)
  const workingDayPredicate = await resolveWorkingDayPredicate(context.workScheduleLabel)

  // Generous prefetch window for holiday lookups — one query up front
  // rather than one per day walked.
  const bufferDays = Math.max(numberOfDays * 2, 30)
  const holidaySet = await fetchHolidayDateSet(start, addDays(start, numberOfDays + bufferDays), context)
  const isHolidayDate = (date: Date) => holidaySet.has(toDateOnlyIso(date))

  const startDateWarning: StartDateWarning | null =
    !workingDayPredicate(start) || isHolidayDate(start)
      ? { isHoliday: isHolidayDate(start), isNonWorkingDay: !workingDayPredicate(start) }
      : null

  let cursor = start
  let countedDays = 0
  const holidaysInRange: string[] = []
  while (countedDays < numberOfDays) {
    if (isHolidayDate(cursor)) {
      holidaysInRange.push(toDateOnlyIso(cursor))
    } else {
      countedDays += 1
    }
    if (countedDays < numberOfDays) cursor = addDays(cursor, 1)
  }
  const lastLeaveDay = cursor
  const calendarDays = Math.round((lastLeaveDay.getTime() - start.getTime()) / MS_PER_DAY) + 1

  // Classify every day in the range exactly once (holiday takes priority
  // over weekend/working, so a holiday landing on a weekend is never
  // double-counted).
  let weekendDaysInRange = 0
  let workingDaysInRange = 0
  for (let d = start; d <= lastLeaveDay; d = addDays(d, 1)) {
    if (isHolidayDate(d)) continue
    if (workingDayPredicate(d)) workingDaysInRange += 1
    else weekendDaysInRange += 1
  }

  let returnToWorkDate = addDays(lastLeaveDay, 1)
  const adjustmentReasons: ("holiday" | "non-working-day")[] = []
  while (!workingDayPredicate(returnToWorkDate) || isHolidayDate(returnToWorkDate)) {
    adjustmentReasons.push(isHolidayDate(returnToWorkDate) ? "holiday" : "non-working-day")
    returnToWorkDate = addDays(returnToWorkDate, 1)
  }

  return {
    startDate: toDateOnlyIso(start),
    requestedDays: numberOfDays,
    lastLeaveDay: toDateOnlyIso(lastLeaveDay),
    returnToWorkDate: toDateOnlyIso(returnToWorkDate),
    calendarDays,
    workingDaysInRange,
    weekendDaysInRange,
    holidaysInRange,
    returnDateAdjusted: adjustmentReasons.length > 0,
    adjustmentReasons,
    startDateWarning,
  }
}
