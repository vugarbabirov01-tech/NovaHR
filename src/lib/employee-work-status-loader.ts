import { findAllLeaveRequests } from "@/repositories/leave-request-repository"
import { findActiveLeaveTypes } from "@/repositories/leave-type-repository"
import { findActiveLeaveByEmployee } from "@/lib/leave/leave-active-status"
import type { WorkStatusContext } from "@/lib/employee-work-status"

/**
 * Fetches everything resolveWorkStatus needs for every employee at once —
 * the one DB round trip an Employee List/Card page pays, instead of one
 * per employee. Every consumer (Employee List, Employee Card, Employee
 * Profile, the Dashboard's Recent Employees widget, the org-wide Dashboard
 * KPI) calls this same loader, so there is exactly one place that decides
 * what "on approved leave right now" means.
 *
 * Split out from employee-work-status.ts on purpose: this is the one piece
 * that touches Prisma repositories, and WorkStatusBadge ("use client")
 * imports that sibling module directly for the WorkStatus type + display
 * metadata — bundling this loader into the same file would pull Prisma
 * into the client bundle the moment the badge component is imported
 * anywhere (Next.js build failure: "node:fs" has no browser polyfill).
 * Only Server Components should ever import this file.
 */
export async function loadWorkStatusContext(asOfDate: Date = new Date()): Promise<WorkStatusContext> {
  const [requests, leaveTypes] = await Promise.all([findAllLeaveRequests(), findActiveLeaveTypes()])
  return {
    activeLeaveByEmployee: findActiveLeaveByEmployee(requests, asOfDate),
    leaveTypeCodeById: new Map(leaveTypes.map((leaveType) => [leaveType.id, leaveType.code])),
  }
}
