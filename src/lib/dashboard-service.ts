import { employeeDirectory } from "@/data/employee-directory"

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
 */
export function getDashboardKpis(): DashboardKpis {
  const totalEmployees = employeeDirectory.filter(
    (employee) => employee.employmentStatus !== "terminated"
  ).length
  const activeEmployees = employeeDirectory.filter(
    (employee) => employee.employmentStatus === "active"
  ).length
  const onLeave = employeeDirectory.filter((employee) => employee.employmentStatus === "on-leave").length

  const now = new Date()
  const newHires = employeeDirectory.filter((employee) => {
    const hireDate = new Date(employee.employment.hireDate)
    return hireDate.getFullYear() === now.getFullYear() && hireDate.getMonth() === now.getMonth()
  }).length

  return { totalEmployees, activeEmployees, onLeave, newHires }
}
