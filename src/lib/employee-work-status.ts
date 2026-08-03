import type { LeaveRequest } from "@/repositories/leave-request-repository"

/**
 * An employee's live, day-to-day status — orthogonal to EmploymentStatus
 * (the legal/administrative relationship, which never changes because of
 * leave; see the doc comment on EmploymentStatus itself). Computed fresh
 * from approved LeaveRequest data every time it's asked for, never stored
 * on the employee record — there is no field to go stale.
 *
 * ON_BUSINESS_TRIP exists in this union for completeness but resolveWorkStatus
 * never returns it today: there is no LeaveType / data source a business
 * trip could be derived from (Leave module has no "business trip" leave
 * type, and this task's business rules only describe deriving status from
 * approved leave requests). Wiring a real source for it is future work, not
 * a silent gap — see the mapping table below.
 *
 * This file is pure and client-safe on purpose — WorkStatusBadge ("use
 * client") imports the type and display metadata from here directly.
 * Actually fetching the data (loadWorkStatusContext, which touches Prisma
 * repositories) lives in the sibling employee-work-status-loader.ts instead,
 * so a client component importing this module never pulls Prisma into the
 * browser bundle.
 */
export type WorkStatus =
  | "AT_WORK"
  | "ON_LEAVE"
  | "ON_SICK_LEAVE"
  | "ON_PATERNITY_LEAVE"
  | "ON_MATERNITY_LEAVE"
  | "ON_UNPAID_LEAVE"
  | "ON_BUSINESS_TRIP"

/**
 * LeaveType.code -> WorkStatus. The seeded catalog (prisma/seed.ts) has six
 * types; STUDY has no dedicated WorkStatus value in the business rules this
 * was specified against, so it buckets into the generic ON_LEAVE alongside
 * ANNUAL rather than inventing a status value nothing asked for. Any future
 * LeaveType code not listed here also falls back to the generic ON_LEAVE in
 * resolveWorkStatus below — an unrecognized *approved* leave is still leave,
 * never silently reported as AT_WORK.
 */
const LEAVE_TYPE_CODE_TO_WORK_STATUS: Record<string, WorkStatus> = {
  ANNUAL: "ON_LEAVE",
  STUDY: "ON_LEAVE",
  SICK: "ON_SICK_LEAVE",
  MATERNITY: "ON_MATERNITY_LEAVE",
  PATERNITY: "ON_PATERNITY_LEAVE",
  UNPAID: "ON_UNPAID_LEAVE",
}

export interface WorkStatusContext {
  activeLeaveByEmployee: Map<string, LeaveRequest>
  leaveTypeCodeById: Map<string, string>
}

/**
 * The single place "what is this employee doing right now" is decided.
 * Every surface that displays a work status (Employee List, Employee Card,
 * Employee Profile, Employee badges anywhere, the Dashboard's Recent
 * Employees widget) must call this — never re-derive it from
 * employmentStatus, and never duplicate the "is there an approved request
 * covering today" check locally.
 */
export function resolveWorkStatus(employeeId: string, context: WorkStatusContext): WorkStatus {
  const activeRequest = context.activeLeaveByEmployee.get(employeeId)
  if (!activeRequest) return "AT_WORK"
  const code = context.leaveTypeCodeById.get(activeRequest.leaveTypeId)
  return (code && LEAVE_TYPE_CODE_TO_WORK_STATUS[code]) || "ON_LEAVE"
}

// Display metadata for WorkStatusBadge — kept here rather than in the
// component itself, the same split EmploymentStatusBadge/lib/employees.ts
// already uses. Maternity/Paternity/Unpaid share ON_LEAVE's amber tone
// (all "away, non-medical" leave reads the same at a glance) but each still
// gets its own precise label — grouping the tone isn't the same as
// grouping the words a screen reader announces.
export const workStatusToneClassName: Record<WorkStatus, string> = {
  AT_WORK: "bg-status-good",
  ON_LEAVE: "bg-status-warning",
  ON_SICK_LEAVE: "bg-orange-500",
  ON_PATERNITY_LEAVE: "bg-status-warning",
  ON_MATERNITY_LEAVE: "bg-status-warning",
  ON_UNPAID_LEAVE: "bg-status-warning",
  ON_BUSINESS_TRIP: "bg-sky-500",
}

export const workStatusTextClassName: Record<WorkStatus, string> = {
  AT_WORK: "text-status-good",
  ON_LEAVE: "text-amber-700",
  ON_SICK_LEAVE: "text-orange-700",
  ON_PATERNITY_LEAVE: "text-amber-700",
  ON_MATERNITY_LEAVE: "text-amber-700",
  ON_UNPAID_LEAVE: "text-amber-700",
  ON_BUSINESS_TRIP: "text-sky-700",
}

export const workStatusMessageKeys: Record<
  WorkStatus,
  "atWork" | "onLeave" | "onSickLeave" | "onPaternityLeave" | "onMaternityLeave" | "onUnpaidLeave" | "onBusinessTrip"
> = {
  AT_WORK: "atWork",
  ON_LEAVE: "onLeave",
  ON_SICK_LEAVE: "onSickLeave",
  ON_PATERNITY_LEAVE: "onPaternityLeave",
  ON_MATERNITY_LEAVE: "onMaternityLeave",
  ON_UNPAID_LEAVE: "onUnpaidLeave",
  ON_BUSINESS_TRIP: "onBusinessTrip",
}
