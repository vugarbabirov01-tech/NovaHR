import type { LeaveRequest } from "@/repositories/leave-request-repository"

/**
 * Company-wide HR KPIs for the Leave Dashboard — deliberately NOT
 * per-employee balance figures (Initial/Previous Year/Used/Current belong
 * on the Employee Leave tab only; see leave-tab.tsx). Pure function over
 * whatever LeaveRequest[] the page already fetched (getAllLeaveRequestsAction)
 * — no extra DB round trip, no new backend API, just a different way of
 * summarizing data the dashboard was already loading.
 */
export interface LeaveDashboardKpis {
  pendingApprovals: number
  employeesOnLeave: number
  startingThisWeek: number
  endingThisWeek: number
  leavesThisMonth: number
  approvedThisMonth: number
  rejectedThisMonth: number
}

/**
 * LeaveRequest.startDate/endDate are date-ONLY values: submitLeaveRequestAction
 * builds them via `new Date(dateOnlyString)`, which the spec parses as UTC
 * midnight, not local midnight (see the matching doc comment in
 * leave-policy-resolution-service.ts — this is the exact bug that turned
 * "03.08.2026" into "02.08.2026" on the Review step). Comparing them
 * against a *locally*-computed "today"/"this week"/"this month" boundary
 * would silently misclassify a leave starting today as not-today in any
 * timezone that isn't UTC (this deployment runs Asia/Baku, UTC+4). So the
 * boundaries used against startDate/endDate are built with Date.UTC from
 * "now"'s LOCAL calendar date (what a human means by "today"), not with
 * local mutation — matching the UTC-midnight anchor those fields already
 * use, rather than fighting it.
 */
function utcMidnightOfLocalDate(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

/** Monday-anchored week, matching this codebase's existing work-week
 * convention (WEEKDAY_CODES in leave-policy-resolution-service.ts starts
 * the enumeration at Sunday=0 but the default working pattern is Mon-Fri). */
function startOfWeekUtc(now: Date): Date {
  const today = utcMidnightOfLocalDate(now)
  const weekday = today.getUTCDay()
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday
  today.setUTCDate(today.getUTCDate() + diffToMonday)
  return today
}

function endOfWeekUtc(now: Date): Date {
  const start = startOfWeekUtc(now)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)
  return end
}

function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
}

function endOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999))
}

/**
 * decidedAt, unlike startDate/endDate, is a real instant (`new Date()` at
 * decision time — see leave-request-decision-service.ts), not a date-only
 * value anchored to UTC midnight. "This month" for a decision timestamp is
 * a genuine local-calendar question (what HR would call "this month" in
 * their own timezone), so this stays local rather than UTC-anchored —
 * mixing the two boundary systems is intentional, not an inconsistency.
 */
function startOfLocalMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function endOfLocalMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
}

function isWithin(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end
}

export function computeLeaveDashboardKpis(requests: LeaveRequest[], now: Date = new Date()): LeaveDashboardKpis {
  const today = utcMidnightOfLocalDate(now)
  const weekStart = startOfWeekUtc(now)
  const weekEnd = endOfWeekUtc(now)
  const monthStartUtc = startOfMonthUtc(now)
  const monthEndUtc = endOfMonthUtc(now)
  const monthStartLocal = startOfLocalMonth(now)
  const monthEndLocal = endOfLocalMonth(now)

  const approved = requests.filter((r) => r.status === "APPROVED")

  const pendingApprovals = requests.filter((r) => r.status === "PENDING_APPROVAL").length

  const employeesOnLeave = new Set(
    approved.filter((r) => r.startDate <= today && today <= r.endDate).map((r) => r.employeeId)
  ).size

  const startingThisWeek = approved.filter((r) => isWithin(r.startDate, weekStart, weekEnd)).length
  const endingThisWeek = approved.filter((r) => isWithin(r.endDate, weekStart, weekEnd)).length
  const leavesThisMonth = approved.filter((r) => isWithin(r.startDate, monthStartUtc, monthEndUtc)).length

  const approvedThisMonth = requests.filter(
    (r) => r.status === "APPROVED" && r.decidedAt && isWithin(r.decidedAt, monthStartLocal, monthEndLocal)
  ).length
  const rejectedThisMonth = requests.filter(
    (r) => r.status === "REJECTED" && r.decidedAt && isWithin(r.decidedAt, monthStartLocal, monthEndLocal)
  ).length

  return {
    pendingApprovals,
    employeesOnLeave,
    startingThisWeek,
    endingThisWeek,
    leavesThisMonth,
    approvedThisMonth,
    rejectedThisMonth,
  }
}
