import { findAllLeaveRequestsForReporting } from "@/repositories/leave-request-repository"
import { findAllEmployees } from "@/repositories/employee-repository"
import { getFullName } from "@/lib/employees"
import type { ReportRow } from "@/types/reports"

/**
 * Allowlist, not a blocklist — any leave type whose code is not explicitly
 * listed here is excluded, including every type that does not exist yet.
 * A newly-added LeaveType is invisible to this report source by default
 * until someone deliberately adds its code below, which is the safe
 * direction to default in: a leak requires an explicit code change, never
 * an omission. Sick/Maternity/Paternity (SICK/MATERNITY/PATERNITY) are
 * excluded as health/family-status data, same sensitivity class as the
 * Labour Law fields Phase 1 already excludes from the Employees source.
 * Unpaid/Social leave (UNPAID/SOCIAL) are excluded too — both can hint at
 * personal circumstances — leaving Annual and Study leave as the only
 * two visible categories today. This list is an explicit, reviewable
 * judgment call, not a technical constraint; broadening it is a one-line
 * change here, never anywhere else (filter engine, UI, export all read
 * whatever rows this function returns, with no separate check of their
 * own — there is nothing downstream for an excluded row to leak through).
 */
const VISIBLE_LEAVE_TYPE_CODES: ReadonlySet<string> = new Set(["ANNUAL", "STUDY"])

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export async function fetchLeaveRequestReportRows(): Promise<ReportRow[]> {
  const [requests, employees] = await Promise.all([findAllLeaveRequestsForReporting(), findAllEmployees()])

  const employeeContextById = new Map(
    employees.map((employee) => [
      employee.id,
      {
        name: getFullName(employee.personal),
        department: employee.employment.department ?? "",
        company: employee.employment.company ?? "",
      },
    ])
  )

  return requests
    .filter((request) => VISIBLE_LEAVE_TYPE_CODES.has(request.leaveType.code))
    .map((request) => {
      const context = employeeContextById.get(request.employeeId)
      return {
        leaveTypeName: request.leaveType.name,
        leaveStartDate: toIsoDate(request.startDate),
        leaveEndDate: toIsoDate(request.endDate),
        leaveRequestedUnits: request.requestedUnits,
        leaveStatus: request.status,
        leaveEmployeeName: context?.name ?? "",
        leaveEmployeeDepartment: context?.department ?? "",
        leaveEmployeeCompany: context?.company ?? "",
      }
    })
}
