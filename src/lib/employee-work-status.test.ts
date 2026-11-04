import { describe, expect, it } from "vitest"

import { findActiveLeaveByEmployee } from "@/lib/leave/leave-active-status"
import { resolveWorkStatus, type WorkStatusContext } from "@/lib/employee-work-status"
import { loadWorkStatusContext } from "@/lib/employee-work-status-loader"
import { findActiveLeaveTypes } from "@/repositories/leave-type-repository"
import { createLeaveRequest, deleteLeaveRequestsByEmployees, type LeaveRequest } from "@/repositories/leave-request-repository"
import { withTestEmployee } from "@/lib/leave/leave-test-fixtures"

const NOW = new Date("2026-08-05T10:00:00")

function makeRequest(overrides: Partial<LeaveRequest>): LeaveRequest {
  return {
    id: overrides.id ?? "req-1",
    employeeId: overrides.employeeId ?? "EMP-TEST",
    leaveTypeId: overrides.leaveTypeId ?? "leave-type-1",
    companyId: null,
    branchId: null,
    startDate: overrides.startDate ?? new Date("2026-08-01"),
    endDate: overrides.endDate ?? new Date("2026-08-10"),
    requestedUnits: 5,
    status: overrides.status ?? "APPROVED",
    reason: null,
    submittedAt: new Date("2026-07-20"),
    decidedAt: new Date("2026-07-25"),
    decidedBy: "HR",
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    createdAt: new Date("2026-07-20"),
    updatedAt: new Date("2026-07-20"),
  } as LeaveRequest
}

/**
 * Regression coverage for the Employment Status / Work Status conflation
 * bug: an approved leave request used to have no effect on how an employee
 * was displayed anywhere (badges all read a static, hand-set field that
 * nothing ever recomputed). These tests exercise the two functions that
 * replace that: findActiveLeaveByEmployee (shared by the Leave Dashboard's
 * "Employees Currently on Leave" KPI too — see leave-dashboard-kpis.ts) and
 * resolveWorkStatus (every employee-facing badge).
 */
describe("findActiveLeaveByEmployee", () => {
  it("only counts APPROVED requests covering the given date", () => {
    const requests = [
      makeRequest({ id: "a", employeeId: "EMP-1", status: "APPROVED" }),
      makeRequest({ id: "b", employeeId: "EMP-2", status: "PENDING_APPROVAL" }),
      makeRequest({ id: "c", employeeId: "EMP-3", status: "REJECTED" }),
      makeRequest({ id: "d", employeeId: "EMP-4", status: "CANCELLED" }),
    ]
    const active = findActiveLeaveByEmployee(requests, NOW)
    expect(active.has("EMP-1")).toBe(true)
    expect(active.has("EMP-2")).toBe(false)
    expect(active.has("EMP-3")).toBe(false)
    expect(active.has("EMP-4")).toBe(false)
  })

  it("excludes approved requests whose range doesn't cover today", () => {
    const requests = [
      makeRequest({
        id: "past",
        employeeId: "EMP-1",
        status: "APPROVED",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-05"),
      }),
      makeRequest({
        id: "future",
        employeeId: "EMP-2",
        status: "APPROVED",
        startDate: new Date("2026-12-01"),
        endDate: new Date("2026-12-05"),
      }),
    ]
    const active = findActiveLeaveByEmployee(requests, NOW)
    expect(active.size).toBe(0)
  })

  it("does not silently roll back a single-day leave that starts today (the timezone bug class)", () => {
    // Same trap as the Review-screen date bug: startDate/endDate are
    // UTC-midnight-anchored date-only values (`new Date("2026-08-05")`,
    // matching how submitLeaveRequestAction actually builds them), while
    // NOW here carries a real local time-of-day component. A single-day
    // approved leave exactly on "today" must still be found.
    const requests = [
      makeRequest({
        id: "a",
        employeeId: "EMP-1",
        startDate: new Date("2026-08-05"),
        endDate: new Date("2026-08-05"),
      }),
    ]
    const active = findActiveLeaveByEmployee(requests, NOW)
    expect(active.has("EMP-1")).toBe(true)
  })
})

describe("resolveWorkStatus", () => {
  function context(activeLeaveByEmployee: Map<string, LeaveRequest>, leaveTypeCodeById: Map<string, string>): WorkStatusContext {
    return { activeLeaveByEmployee, leaveTypeCodeById }
  }

  it("returns AT_WORK for an employee with no active approved leave", () => {
    const ctx = context(new Map(), new Map())
    expect(resolveWorkStatus("EMP-1", ctx)).toBe("AT_WORK")
  })

  it("maps each seeded LeaveType code to its own WorkStatus", () => {
    const cases: [string, ReturnType<typeof resolveWorkStatus>][] = [
      ["ANNUAL", "ON_LEAVE"],
      ["STUDY", "ON_LEAVE"],
      ["SICK", "ON_SICK_LEAVE"],
      ["MATERNITY", "ON_MATERNITY_LEAVE"],
      ["PATERNITY", "ON_PATERNITY_LEAVE"],
      ["UNPAID", "ON_UNPAID_LEAVE"],
    ]
    for (const [code, expected] of cases) {
      const request = makeRequest({ employeeId: "EMP-1", leaveTypeId: "lt-1" })
      const ctx = context(new Map([["EMP-1", request]]), new Map([["lt-1", code]]))
      expect(resolveWorkStatus("EMP-1", ctx)).toBe(expected)
    }
  })

  it("falls back to the generic ON_LEAVE for an unrecognized leave type code", () => {
    const request = makeRequest({ employeeId: "EMP-1", leaveTypeId: "lt-1" })
    const ctx = context(new Map([["EMP-1", request]]), new Map([["lt-1", "SOME_FUTURE_TYPE"]]))
    expect(resolveWorkStatus("EMP-1", ctx)).toBe("ON_LEAVE")
  })

  it("never returns -0-adjacent or crashes when the employee isn't in either map", () => {
    const ctx = context(new Map(), new Map())
    expect(() => resolveWorkStatus("EMP-DOES-NOT-EXIST", ctx)).not.toThrow()
    expect(resolveWorkStatus("EMP-DOES-NOT-EXIST", ctx)).toBe("AT_WORK")
  })
})

describe("loadWorkStatusContext — real data integration", () => {
  it("resolves to ON_LEAVE while a real APPROVED Annual Leave request is active, and AT_WORK outside it", async () => {
    // Exercises the actual DB-backed loader end to end, not just the pure
    // resolveWorkStatus function above — against a throwaway employee +
    // throwaway LeaveRequest (withTestEmployee + createLeaveRequest,
    // cleaned up in finally), never a specific real employee id. A
    // previous version of this test hardcoded "EMP-1041" and assumed a
    // specific real LeaveRequest already existed for it in dev.db — both
    // assumptions went stale the same way the Leave test suite's other
    // fixtures did (see leave-test-fixtures.ts's own comment).
    const annual = (await findActiveLeaveTypes()).find((t) => t.code === "ANNUAL")
    expect(annual).toBeDefined()

    await withTestEmployee("EMP-1041", async (employee) => {
      try {
        await createLeaveRequest({
          employeeId: employee.id,
          leaveTypeId: annual!.id,
          startDate: new Date("2026-08-03"),
          endDate: new Date("2026-08-23"),
          requestedUnits: 15,
          status: "APPROVED",
          decidedBy: "TEST",
        })

        const duringLeave = await loadWorkStatusContext(new Date("2026-08-10"))
        expect(resolveWorkStatus(employee.id, duringLeave)).toBe("ON_LEAVE")

        const beforeLeave = await loadWorkStatusContext(new Date("2026-08-01"))
        expect(resolveWorkStatus(employee.id, beforeLeave)).toBe("AT_WORK")

        const afterLeave = await loadWorkStatusContext(new Date("2026-08-24"))
        expect(resolveWorkStatus(employee.id, afterLeave)).toBe("AT_WORK")
      } finally {
        await deleteLeaveRequestsByEmployees([employee.id])
      }
    })
  })
})
