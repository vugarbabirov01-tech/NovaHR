// Validates and applies HR's work-book decision. Pure: the server action loads
// and saves; this builds the new record.

import { isValidIsoDate, officialExperience, resolveExperience } from "@/lib/experience/work-experience"
import { resolveAnnualLeaveEntitlement } from "@/lib/leave/leave-policy-resolution-service"
import type {
  AuditLogEntry,
  EmployeeProfile,
  WorkBookExperience,
  WorkBookPeriod,
  WorkBookStatus,
  WorkExperienceDuration,
} from "@/types/employee-profile"

export interface WorkBookPeriodInput {
  organization: string
  position: string
  startDate: string
  endDate: string
}

export interface WorkBookReviewInput {
  status: WorkBookStatus
  declaredTotal: WorkExperienceDuration
  periods: WorkBookPeriodInput[]
  note: string
  reviewedBy: string
}

export type WorkBookErrorCode =
  | "invalidStatus"
  | "invalidTotal"
  | "organizationRequired"
  | "invalidPeriodDate"
  | "periodOrder"
  | "futurePeriod"
  | "reviewerRequired"
  | "noteRequired"
  | "nothingToConfirm"
  | "notFound"
  | "unknown"

const STATUSES: WorkBookStatus[] = ["pending", "confirmed", "rejected"]

const isWhole = (value: number, max: number) => Number.isInteger(value) && value >= 0 && value <= max

export function validateWorkBookReview(input: WorkBookReviewInput, today: string): WorkBookErrorCode | null {
  if (!STATUSES.includes(input.status)) return "invalidStatus"
  const { years, months, days } = input.declaredTotal
  if (!isWhole(years, 70) || !isWhole(months, 11) || !isWhole(days, 30)) return "invalidTotal"
  for (const period of input.periods) {
    if (!period.organization.trim()) return "organizationRequired"
    if (!isValidIsoDate(period.startDate) || !isValidIsoDate(period.endDate)) return "invalidPeriodDate"
    if (period.endDate < period.startDate) return "periodOrder"
    if (period.endDate > today) return "futurePeriod"
  }
  if (!input.reviewedBy.trim()) return "reviewerRequired"
  // A decision either way has to say what it is based on.
  if (input.status !== "pending" && !input.note.trim()) return "noteRequired"
  if (input.status === "confirmed" && input.periods.length === 0 && years + months + days === 0) {
    return "nothingToConfirm"
  }
  return null
}

export interface WorkBookReviewOutcome {
  profile: EmployeeProfile
  leaveDaysBefore: number
  leaveDaysAfter: number
  effective: WorkExperienceDuration
  overlapEmasDays: number
  overlapCurrentDays: number
}

const text = (d: WorkExperienceDuration) => `${d.years}/${d.months}/${d.days}`

/** Only the work-book block and the figures derived from it change; ƏMAS data is never touched. */
export function applyWorkBookReview(
  existing: EmployeeProfile,
  input: WorkBookReviewInput,
  now: Date = new Date()
): WorkBookReviewOutcome {
  const profile: EmployeeProfile = structuredClone(existing)
  const periods: WorkBookPeriod[] = input.periods.map((period, index) => ({
    id: `WB-${profile.id}-${index + 1}`,
    organization: period.organization.trim(),
    position: period.position.trim() || undefined,
    startDate: period.startDate,
    endDate: period.endDate,
  }))
  const { years, months, days } = input.declaredTotal
  const workBook: WorkBookExperience = {
    status: input.status,
    declaredTotal: years + months + days > 0 ? { years, months, days } : undefined,
    periods,
    note: input.note.trim() || undefined,
    reviewedBy: input.reviewedBy.trim(),
    reviewedAt: now.toISOString(),
  }

  const leaveDaysBefore = resolveAnnualLeaveEntitlement(existing, now).totalDays

  // Pin the official figure before the effective one is allowed to differ from it.
  profile.labourLaw.officialPreviousExperience = officialExperience(existing.labourLaw)
  profile.labourLaw.workBook = workBook
  const resolved = resolveExperience(profile, now)
  profile.labourLaw.previousWorkExperience = resolved.effective

  const entitlement = resolveAnnualLeaveEntitlement(profile, now)
  const seniority = entitlement.components.filter((c) => c.article === "Art. 116").reduce((sum, c) => sum + c.days, 0)
  profile.leave.annualLeaveEntitlement = entitlement.totalDays - seniority
  profile.leave.additionalLeaveEntitlement = seniority

  const entry: AuditLogEntry = {
    id: `AUD-${profile.id}-WB-${now.toISOString()}`,
    timestamp: now.toISOString(),
    actor: workBook.reviewedBy!,
    action: `workBook.${input.status}`,
    field: "labourLaw.previousWorkExperience",
    oldValue: text(existing.labourLaw.previousWorkExperience),
    newValue: [
      text(resolved.effective),
      workBook.declaredTotal ? `total ${text(workBook.declaredTotal)}` : "",
      periods.map((p) => `${p.organization} ${p.startDate}..${p.endDate}`).join(", "),
      workBook.note ?? "",
    ]
      .filter(Boolean)
      .join(" | "),
  }
  profile.auditLog = [...(profile.auditLog ?? []), entry]

  return {
    profile,
    leaveDaysBefore,
    leaveDaysAfter: entitlement.totalDays,
    effective: resolved.effective,
    overlapEmasDays: resolved.periods?.overlapEmasDays ?? 0,
    overlapCurrentDays: resolved.periods?.overlapCurrentDays ?? 0,
  }
}
