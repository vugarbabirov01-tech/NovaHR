import { describe, expect, it } from "vitest"

import { computeLeaveDashboardKpis } from "@/lib/leave/leave-dashboard-kpis"
import type { LeaveRequest } from "@/repositories/leave-request-repository"

/**
 * "now" pinned to a Wednesday so the Monday-anchored week has known
 * boundaries: week = 2026-08-03 (Mon) .. 2026-08-09 (Sun); month = August
 * 2026 (2026-08-01 .. 2026-08-31).
 */
const NOW = new Date("2026-08-05T10:00:00")

function makeRequest(overrides: Partial<LeaveRequest>): LeaveRequest {
  return {
    id: overrides.id ?? "req-1",
    employeeId: overrides.employeeId ?? "EMP-TEST",
    leaveTypeId: "annual",
    companyId: null,
    branchId: null,
    startDate: overrides.startDate ?? new Date("2026-08-01"),
    endDate: overrides.endDate ?? new Date("2026-08-05"),
    requestedUnits: 5,
    status: overrides.status ?? "PENDING_APPROVAL",
    reason: null,
    submittedAt: new Date("2026-07-20"),
    decidedAt: overrides.decidedAt ?? null,
    decidedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    createdAt: new Date("2026-07-20"),
    updatedAt: new Date("2026-07-20"),
  } as LeaveRequest
}

describe("computeLeaveDashboardKpis", () => {
  it("counts pending approvals regardless of dates", () => {
    const requests = [
      makeRequest({ id: "a", status: "PENDING_APPROVAL" }),
      makeRequest({ id: "b", status: "PENDING_APPROVAL" }),
      makeRequest({ id: "c", status: "APPROVED" }),
    ]
    expect(computeLeaveDashboardKpis(requests, NOW).pendingApprovals).toBe(2)
  })

  it("counts distinct employees currently on leave (approved, spanning today)", () => {
    const requests = [
      makeRequest({
        id: "a",
        employeeId: "EMP-1",
        status: "APPROVED",
        startDate: new Date("2026-08-01"),
        endDate: new Date("2026-08-10"),
      }),
      // Same employee, a second overlapping approved request — must not double-count.
      makeRequest({
        id: "b",
        employeeId: "EMP-1",
        status: "APPROVED",
        startDate: new Date("2026-08-04"),
        endDate: new Date("2026-08-06"),
      }),
      makeRequest({
        id: "c",
        employeeId: "EMP-2",
        status: "APPROVED",
        startDate: new Date("2026-08-05"),
        endDate: new Date("2026-08-05"),
      }),
      // Approved but the range doesn't cover "today" (2026-08-05).
      makeRequest({
        id: "d",
        employeeId: "EMP-3",
        status: "APPROVED",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2026-09-05"),
      }),
      // Pending — must not count as "on leave" even if dates overlap today.
      makeRequest({
        id: "e",
        employeeId: "EMP-4",
        status: "PENDING_APPROVAL",
        startDate: new Date("2026-08-05"),
        endDate: new Date("2026-08-05"),
      }),
    ]
    expect(computeLeaveDashboardKpis(requests, NOW).employeesOnLeave).toBe(2)
  })

  it("counts approved leaves starting/ending within the current Mon-Sun week", () => {
    const requests = [
      // Starts Tuesday this week (2026-08-04) — inside the week.
      makeRequest({ id: "a", status: "APPROVED", startDate: new Date("2026-08-04"), endDate: new Date("2026-08-12") }),
      // Starts next Monday (2026-08-10) — outside this week.
      makeRequest({ id: "b", status: "APPROVED", startDate: new Date("2026-08-10"), endDate: new Date("2026-08-14") }),
      // Ends Sunday this week (2026-08-09).
      makeRequest({ id: "c", status: "APPROVED", startDate: new Date("2026-07-28"), endDate: new Date("2026-08-09") }),
      // Pending with dates inside the week — must not count (approved-only).
      makeRequest({
        id: "d",
        status: "PENDING_APPROVAL",
        startDate: new Date("2026-08-06"),
        endDate: new Date("2026-08-07"),
      }),
    ]
    const kpis = computeLeaveDashboardKpis(requests, NOW)
    expect(kpis.startingThisWeek).toBe(1)
    expect(kpis.endingThisWeek).toBe(1)
  })

  it("counts approved leaves starting within the current month", () => {
    const requests = [
      makeRequest({ id: "a", status: "APPROVED", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-03") }),
      makeRequest({ id: "b", status: "APPROVED", startDate: new Date("2026-08-31"), endDate: new Date("2026-09-02") }),
      makeRequest({ id: "c", status: "APPROVED", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-05") }),
      makeRequest({ id: "d", status: "REJECTED", startDate: new Date("2026-08-15"), endDate: new Date("2026-08-16") }),
    ]
    expect(computeLeaveDashboardKpis(requests, NOW).leavesThisMonth).toBe(2)
  })

  it("counts decisions made this month by decidedAt, not by leave dates", () => {
    const requests = [
      makeRequest({ id: "a", status: "APPROVED", decidedAt: new Date("2026-08-02") }),
      makeRequest({ id: "b", status: "APPROVED", decidedAt: new Date("2026-07-31") }), // last month — excluded
      makeRequest({ id: "c", status: "REJECTED", decidedAt: new Date("2026-08-04") }),
      makeRequest({ id: "d", status: "REJECTED", decidedAt: null }), // never decided — excluded
      makeRequest({ id: "e", status: "PENDING_APPROVAL", decidedAt: null }),
    ]
    const kpis = computeLeaveDashboardKpis(requests, NOW)
    expect(kpis.approvedThisMonth).toBe(1)
    expect(kpis.rejectedThisMonth).toBe(1)
  })

  it("returns all zeros for an empty request list", () => {
    expect(computeLeaveDashboardKpis([], NOW)).toEqual({
      pendingApprovals: 0,
      employeesOnLeave: 0,
      startingThisWeek: 0,
      endingThisWeek: 0,
      leavesThisMonth: 0,
      approvedThisMonth: 0,
      rejectedThisMonth: 0,
    })
  })
})
