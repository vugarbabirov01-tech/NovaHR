import { findAllEmployees } from "@/repositories/employee-repository"
import { findAllLeaveRequests } from "@/repositories/leave-request-repository"
import { findAllLeaveTypes } from "@/repositories/leave-type-repository"
import { findActiveLeaveByEmployee } from "@/lib/leave/leave-active-status"
import { normalizeLeaveAmount } from "@/lib/leave/normalize-leave-amount"
import { getFullName } from "@/lib/employees"
import type { EmployeeProfile } from "@/types/employee-profile"
import type { ActivityItem, UpcomingBirthday } from "@/types/employee"

export interface DashboardKpis {
  totalEmployees: number
  activeEmployees: number
  onLeave: number
  newHires: number
}

/**
 * The Dashboard KPI cards must never calculate business data themselves —
 * this is the one place that reads employeeDirectory and turns it into the
 * four counts kpi-section.tsx renders. Terminated employees are excluded
 * from Total Employees, matching the rest of the app's default visibility
 * rule. There is no historical month-over-month snapshot to compute a real
 * trend delta from, so none is fabricated here — the KPI cards simply don't
 * show one.
 *
 * onLeave used to filter employmentStatus === "on-leave" — a static field
 * nothing ever recomputed, so it silently went stale the moment a leave
 * request was approved or its dates passed. It now shares the exact same
 * "who's on approved leave today" computation the Leave Dashboard's
 * "Employees Currently on Leave" KPI and each employee's WorkStatus badge
 * use (findActiveLeaveByEmployee), so this count can never disagree with
 * either of them.
 */
export async function getDashboardKpis(): Promise<DashboardKpis> {
  const employees = await findAllEmployees()
  const totalEmployees = employees.filter(
    (employee) => employee.employmentStatus !== "terminated"
  ).length
  const activeEmployees = employees.filter(
    (employee) => employee.employmentStatus === "active"
  ).length

  const requests = await findAllLeaveRequests()
  const onLeave = findActiveLeaveByEmployee(requests).size

  const now = new Date()
  const newHires = employees.filter((employee) => {
    const hireDate = new Date(employee.employment.hireDate)
    return hireDate.getFullYear() === now.getFullYear() && hireDate.getMonth() === now.getMonth()
  }).length

  return { totalEmployees, activeEmployees, onLeave, newHires }
}

export interface DepartmentHeadcount {
  department: string
  employees: number
}

/**
 * "Şöbələr üzrə Əməkdaşlar" — grouped straight from each employee's own
 * employment.department (the same real, denormalized department name
 * Employee List/Profile already display — see employee-wizard-mapper.ts),
 * never a second demo taxonomy. Active employees only (employmentStatus ===
 * "active"), matching getDashboardKpis' activeEmployees definition one to
 * one — someone on probation/suspended/terminated never inflates a
 * department's count here. Sorted by headcount descending, the same
 * ranking the chart's bars have always shown. An org with zero active
 * employees (or none with a department set) returns [] — the chart itself
 * renders an EmptyState rather than ever falling back to a placeholder
 * department name.
 */
export async function getDepartmentHeadcounts(): Promise<DepartmentHeadcount[]> {
  const employees = await findAllEmployees()
  const counts = new Map<string, number>()

  for (const employee of employees) {
    if (employee.employmentStatus !== "active") continue
    const department = employee.employment.department
    if (!department) continue
    counts.set(department, (counts.get(department) ?? 0) + 1)
  }

  return Array.from(counts, ([department, employees]) => ({ department, employees })).sort(
    (a, b) => b.employees - a.employees
  )
}

/** The date employment actually ended, for employees currently terminated —
 * written by terminateEmployeeAction onto employment.history as a
 * "termination" event (src/lib/termination/actions.ts), never a separate
 * field. A currently-active/probation/suspended employee has no such date.
 * If an employee was terminated more than once (rehired in between), the
 * most recent termination event is what ended their current employment. */
function getTerminationDate(employee: EmployeeProfile): Date | null {
  if (employee.employmentStatus !== "terminated") return null
  const events = employee.employment.history.filter((event) => event.type === "termination")
  if (events.length === 0) return null
  const latest = events.reduce((a, b) => (new Date(a.date) > new Date(b.date) ? a : b))
  return new Date(latest.date)
}

export interface HeadcountTrendPoint {
  monthDate: string
  headcount: number
}

/**
 * "Əməkdaş Sayının Dinamikası" — reconstructed from real per-employee
 * dates rather than a fabricated illustrative series (this used to be a
 * static src/data/dashboard-stats.ts array with no connection to actual
 * hiring/termination history at all). For each of the last `monthsCount`
 * months (this one included), headcount = employees already hired by that
 * month's end whose employment (per getTerminationDate above) hadn't yet
 * ended by then. An employee with no hireDate can't be placed on this
 * timeline and is excluded. Returns [] only when there are no employees at
 * all to chart — the widget shows an EmptyState in that case rather than a
 * fabricated trend line.
 */
export async function getHeadcountTrend(monthsCount = 6): Promise<HeadcountTrendPoint[]> {
  const employees = await findAllEmployees()
  if (employees.length === 0) return []

  const now = new Date()
  const points: HeadcountTrendPoint[] = []

  for (let i = monthsCount - 1; i >= 0; i--) {
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))
    const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999))

    const headcount = employees.filter((employee) => {
      if (!employee.employment.hireDate) return false
      const hireDate = new Date(employee.employment.hireDate)
      if (hireDate > monthEnd) return false
      const terminationDate = getTerminationDate(employee)
      return !terminationDate || terminationDate > monthEnd
    }).length

    points.push({ monthDate: monthStart.toISOString().slice(0, 10), headcount })
  }

  return points
}

/** Whole calendar days from `today` to the next occurrence of
 * `dateOfBirth`'s month/day — wrapping into next year once this year's
 * date has already passed, so a birthday on Jan 3 still counts as "in 5
 * days" from Dec 29. Age itself is never surfaced (the widget only ever
 * displayed month/day), but the wrap always resolves against the real
 * current year, never the employee's birth year. */
function daysUntilNextOccurrence(dateOfBirth: string, today: Date): { date: Date; daysUntil: number } {
  const birth = new Date(dateOfBirth)
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  let next = Date.UTC(today.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate())
  if (next < todayUtc) {
    next = Date.UTC(today.getUTCFullYear() + 1, birth.getUTCMonth(), birth.getUTCDate())
  }
  const msPerDay = 24 * 60 * 60 * 1000
  return { date: new Date(next), daysUntil: Math.round((next - todayUtc) / msPerDay) }
}

/**
 * "Yaxınlaşan Ad Günləri" — every employee's real personal.dateOfBirth,
 * never the old static 4-person src/data/employees.ts array. Active
 * employees only, same definition as getDepartmentHeadcounts above. Within
 * the next `withinDays` days inclusive (0 = today counts). Sorted nearest
 * first; [] when nobody's birthday falls in the window, so the widget's
 * existing EmptyState is what renders rather than a fabricated name.
 */
export async function getUpcomingBirthdays(withinDays = 14): Promise<UpcomingBirthday[]> {
  const employees = await findAllEmployees()
  const today = new Date()

  const withDistance = employees
    .filter((employee) => employee.employmentStatus === "active" && Boolean(employee.personal.dateOfBirth))
    .map((employee) => {
      const { date, daysUntil } = daysUntilNextOccurrence(employee.personal.dateOfBirth, today)
      return { employee, date, daysUntil }
    })
    .filter(({ daysUntil }) => daysUntil >= 0 && daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  return withDistance.map(({ employee, date }) => ({
    id: employee.id,
    name: getFullName(employee.personal),
    avatarUrl: employee.personal.photoUrl,
    department: employee.employment.department,
    date: date.toISOString(),
  }))
}

/**
 * "Son Fəaliyyətlər" — built only from events the app itself actually
 * records, never the old static 6-item src/data/activities.ts array:
 *  - "hire"/"offboarding": every employee's own employment.history, written
 *    at creation (employee-wizard-mapper.ts) and at termination
 *    (src/lib/termination/actions.ts) respectively — the same history the
 *    Employee Profile's own Employment tab reads.
 *  - "leaveRequest": real LeaveRequest rows that were actually submitted
 *    (submittedAt set), restricted to DAYS-unit leave types only — the same
 *    DAYS-only scoping getOrganizationLeaveDaysSummary uses, so an HOURS
 *    request never gets mislabeled as "N days" here.
 * "promotion"/"review"/"document" have no real event source anywhere in
 * the app yet (no feature writes a promotion/review/document-upload
 * timestamp), so this never fabricates them — those ActivityItem variants
 * simply never occur. Sorted newest first, capped at `limit`.
 */
export async function getRecentActivities(limit = 6): Promise<ActivityItem[]> {
  const employees = await findAllEmployees()
  const items: ActivityItem[] = []

  for (const employee of employees) {
    const actor = getFullName(employee.personal)
    for (const event of employee.employment.history) {
      if (event.type === "hire") {
        items.push({
          id: event.id,
          type: "hire",
          actor,
          role: employee.employment.position,
          department: employee.employment.department,
          timestamp: event.date,
        })
      } else if (event.type === "termination") {
        items.push({ id: event.id, type: "offboarding", actor, timestamp: event.date })
      }
    }
  }

  const [leaveRequests, leaveTypes] = await Promise.all([findAllLeaveRequests(), findAllLeaveTypes()])
  const daysUnitLeaveTypeIds = new Set(
    leaveTypes.filter((leaveType) => leaveType.unit === "DAYS").map((leaveType) => leaveType.id)
  )
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]))

  for (const request of leaveRequests) {
    if (!request.submittedAt || !daysUnitLeaveTypeIds.has(request.leaveTypeId)) continue
    const employee = employeesById.get(request.employeeId)
    if (!employee) continue
    items.push({
      id: request.id,
      type: "leaveRequest",
      actor: getFullName(employee.personal),
      days: normalizeLeaveAmount(request.requestedUnits),
      timestamp: request.submittedAt.toISOString(),
    })
  }

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)
}
