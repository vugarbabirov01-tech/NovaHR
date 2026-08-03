import type { LeaveRequest } from "@/repositories/leave-request-repository"

/**
 * LeaveRequest.startDate/endDate are date-ONLY values, always UTC-midnight
 * anchored (submitLeaveRequestAction builds them via `new Date(dateOnlyString)`,
 * which the spec parses as UTC midnight — see the matching doc comment in
 * leave-policy-resolution-service.ts, the exact bug that once turned
 * "03.08.2026" into "02.08.2026" on the Review step). Comparing them against
 * a *locally*-computed "today" would silently misclassify a leave starting
 * today as not-today in any timezone ahead of UTC (this deployment runs
 * Asia/Baku, UTC+4) — so "today" is built from Date.UTC using now's LOCAL
 * calendar date (what a human means by "today"), matching the anchor those
 * fields already use.
 */
export function utcMidnightOfLocalDate(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

/**
 * Every APPROVED LeaveRequest whose [startDate, endDate] span covers
 * `asOfDate`, keyed by employeeId — the single computation "is this
 * employee on leave right now, and via which request" everywhere else
 * derives from. Both the Leave Dashboard's "Employees Currently on Leave"
 * KPI (computeLeaveDashboardKpis) and each employee's displayed WorkStatus
 * (resolveWorkStatus, src/lib/employee-work-status.ts) call this same
 * function — neither re-implements the date-range check, so they can never
 * silently disagree about who's on leave today.
 */
export function findActiveLeaveByEmployee(
  requests: LeaveRequest[],
  asOfDate: Date = new Date()
): Map<string, LeaveRequest> {
  const today = utcMidnightOfLocalDate(asOfDate)
  const activeByEmployee = new Map<string, LeaveRequest>()
  for (const request of requests) {
    if (request.status !== "APPROVED") continue
    if (request.startDate > today || today > request.endDate) continue
    // If an employee somehow has two overlapping approved requests, the
    // first one found wins — deterministic, not a crash. That situation
    // shouldn't occur (approving reduces balance immediately), but this
    // function must never throw over data it didn't create.
    if (!activeByEmployee.has(request.employeeId)) {
      activeByEmployee.set(request.employeeId, request)
    }
  }
  return activeByEmployee
}
