import { employeeDirectory } from "@/data/employee-directory"
import { findAllLeaveRequests } from "@/repositories/leave-request-repository"
import { findActiveLeaveByEmployee } from "@/lib/leave/leave-active-status"

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
  const totalEmployees = employeeDirectory.filter(
    (employee) => employee.employmentStatus !== "terminated"
  ).length
  const activeEmployees = employeeDirectory.filter(
    (employee) => employee.employmentStatus === "active"
  ).length

  const requests = await findAllLeaveRequests()
  const onLeave = findActiveLeaveByEmployee(requests).size

  const now = new Date()
  const newHires = employeeDirectory.filter((employee) => {
    const hireDate = new Date(employee.employment.hireDate)
    return hireDate.getFullYear() === now.getFullYear() && hireDate.getMonth() === now.getMonth()
  }).length

  return { totalEmployees, activeEmployees, onLeave, newHires }
}
