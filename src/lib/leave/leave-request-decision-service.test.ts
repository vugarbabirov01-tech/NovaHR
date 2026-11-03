import { afterEach, describe, expect, it } from "vitest"

import { prisma } from "@/lib/prisma"
import { createLeaveRequest, updateLeaveRequestDecisionIfStatusIn } from "@/repositories/leave-request-repository"
import { findLeaveAuditLogEntriesForEntity } from "@/repositories/leave-audit-log-repository"
import { findActiveLeaveTypes } from "@/repositories/leave-type-repository"
import { computeLeaveBalance } from "@/lib/leave/leave-balance-service"
import {
  createApprovedLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
} from "@/lib/leave/leave-request-decision-service"
import { resolveAnnualLeaveEntitlement } from "@/lib/leave/leave-policy-resolution-service"
import { withTestEmployee } from "@/lib/leave/leave-test-fixtures"

/**
 * Regression coverage for the exact scenario in the bug report:
 *   Initial = entitlement, Used = 0, Current = Initial -> approve -> Used =
 *   requested, Current = Initial - requested -> (separately, from the same
 *   starting point) reject -> everything back to the pre-request baseline.
 * ("Pending" in that original bug report meant "awaiting a decision" — now
 * that creating a leave request IS the decision, `pending` instead means
 * "future-dated and APPROVED"; see sumUpcomingApprovedUnits. Every fixture
 * below uses today's date, so it was never going to show up there either
 * way — the assertions call that out explicitly rather than silently
 * relying on it.)
 *
 * Each test runs against its own throwaway employee (withTestEmployee,
 * leave-test-fixtures.ts — cloned from src/data/employee-directory.ts's
 * seed shapes, never a real HR record) and its own PENDING_APPROVAL
 * request, so pending/ledger totals start clean regardless of what other
 * tests or real data exist. Everything each test writes is torn down in
 * afterEach — LeaveLedgerEntry has no delete function at the repository
 * layer by design (append-only), so cleanup goes through Prisma directly,
 * same as this session's own manual verification scripts did.
 */
const createdRequestIds: string[] = []

afterEach(async () => {
  if (createdRequestIds.length === 0) return
  await prisma.leaveLedgerEntry.deleteMany({
    where: { referenceType: "LEAVE_REQUEST", referenceId: { in: createdRequestIds } },
  })
  await prisma.leaveApproval.deleteMany({ where: { leaveRequestId: { in: createdRequestIds } } })
  await prisma.leaveRequest.deleteMany({ where: { id: { in: createdRequestIds } } })
  createdRequestIds.length = 0
})

async function findAnnualLeaveTypeId(): Promise<string> {
  const annual = (await findActiveLeaveTypes()).find((t) => t.code === "ANNUAL")
  if (!annual) throw new Error("ANNUAL leave type not seeded.")
  return annual.id
}

describe("Leave Request decision flow — Pending -> Approved", () => {
  it("Initial Balance, Used, and Current reflect the approval; Pending returns to 0", async () => {
    await withTestEmployee("EMP-1039", async (employee) => {
      const annualLeaveTypeId = await findAnnualLeaveTypeId()
      const employeeId = employee.id
      const entitlement = resolveAnnualLeaveEntitlement(employee, new Date()).totalDays
      const requestedUnits = 10

      const baseline = await computeLeaveBalance(employeeId, annualLeaveTypeId)
      expect(baseline.pending).toBe(0)
      expect(baseline.opening).toBe(entitlement)
      expect(baseline.taken).toBe(0)
      expect(baseline.remaining).toBe(entitlement)

      const request = await createLeaveRequest({
        employeeId,
        leaveTypeId: annualLeaveTypeId,
        startDate: new Date(),
        endDate: new Date(),
        requestedUnits,
        status: "PENDING_APPROVAL",
      })
      createdRequestIds.push(request.id)

      // Pending: Initial/Used/Current unchanged. `pending` itself stays 0
      // here too — it now means "future-dated APPROVED leave" (see
      // sumUpcomingApprovedUnits), not "awaiting a decision", and a
      // PENDING_APPROVAL row is neither APPROVED nor future-dated in this
      // fixture (startDate is today).
      const pendingState = await computeLeaveBalance(employeeId, annualLeaveTypeId)
      expect(pendingState.opening).toBe(entitlement)
      expect(pendingState.pending).toBe(0)
      expect(pendingState.taken).toBe(0)
      expect(pendingState.remaining).toBe(entitlement)

      await approveLeaveRequest(request.id)

      // Approved: Used -> requested, Current -> Initial - requested. Still
      // not counted in `pending` either, for the same reason — it's today-
      // dated, not upcoming.
      const approvedState = await computeLeaveBalance(employeeId, annualLeaveTypeId)
      expect(approvedState.opening).toBe(entitlement)
      expect(approvedState.pending).toBe(0)
      expect(approvedState.taken).toBe(requestedUnits)
      expect(approvedState.remaining).toBe(entitlement - requestedUnits)
    })
  })

  it("refuses to approve a request that isn't PENDING_APPROVAL", async () => {
    await withTestEmployee("EMP-1037", async (employee) => {
      const annualLeaveTypeId = await findAnnualLeaveTypeId()
      const request = await createLeaveRequest({
        employeeId: employee.id,
        leaveTypeId: annualLeaveTypeId,
        startDate: new Date(),
        endDate: new Date(),
        requestedUnits: 3,
        status: "PENDING_APPROVAL",
      })
      createdRequestIds.push(request.id)

      await approveLeaveRequest(request.id)
      await expect(approveLeaveRequest(request.id)).rejects.toThrow(/pending/i)
    })
  })
})

describe("Leave Request decision flow — Pending -> Rejected", () => {
  it("balances return exactly to the pre-request baseline; Pending stays 0 throughout", async () => {
    await withTestEmployee("EMP-1038", async (employee) => {
      const annualLeaveTypeId = await findAnnualLeaveTypeId()
      const employeeId = employee.id
      const entitlement = resolveAnnualLeaveEntitlement(employee, new Date()).totalDays
      const requestedUnits = 10

      const request = await createLeaveRequest({
        employeeId,
        leaveTypeId: annualLeaveTypeId,
        startDate: new Date(),
        endDate: new Date(),
        requestedUnits,
        status: "PENDING_APPROVAL",
      })
      createdRequestIds.push(request.id)

      // Today-dated and not yet APPROVED — `pending` (future-dated APPROVED
      // leave) was never going to count this one either way.
      const pendingState = await computeLeaveBalance(employeeId, annualLeaveTypeId)
      expect(pendingState.pending).toBe(0)

      await rejectLeaveRequest(request.id, "Insufficient team coverage")

      const rejectedState = await computeLeaveBalance(employeeId, annualLeaveTypeId)
      expect(rejectedState.opening).toBe(entitlement)
      expect(rejectedState.pending).toBe(0)
      expect(rejectedState.taken).toBe(0)
      expect(rejectedState.remaining).toBe(entitlement)
    })
  })
})

describe("Leave Request decision flow — cancellation", () => {
  it("cancelling an APPROVED request reverses the ledger (LEAVE_CANCELLED) and restores the balance", async () => {
    await withTestEmployee("EMP-0871", async (employee) => {
      const annualLeaveTypeId = await findAnnualLeaveTypeId()
      const employeeId = employee.id
      const entitlement = resolveAnnualLeaveEntitlement(employee, new Date()).totalDays
      const requestedUnits = 4

      const request = await createLeaveRequest({
        employeeId,
        leaveTypeId: annualLeaveTypeId,
        startDate: new Date(),
        endDate: new Date(),
        requestedUnits,
        status: "PENDING_APPROVAL",
      })
      createdRequestIds.push(request.id)

      await approveLeaveRequest(request.id)
      const approvedState = await computeLeaveBalance(employeeId, annualLeaveTypeId)
      expect(approvedState.remaining).toBe(entitlement - requestedUnits)

      await cancelLeaveRequest(request.id, "Employee changed plans")
      const cancelledState = await computeLeaveBalance(employeeId, annualLeaveTypeId)
      expect(cancelledState.remaining).toBe(entitlement)
      // LEAVE_TAKEN(-4) netted with LEAVE_CANCELLED(+4) is 0, not -0.
      expect(cancelledState.taken).toBe(0)
      expect(Object.is(cancelledState.taken, -0)).toBe(false)
    })
  })

  it("cancelling a still-PENDING request needs no ledger reversal — it never wrote one", async () => {
    await withTestEmployee("EMP-1011", async (employee) => {
      const annualLeaveTypeId = await findAnnualLeaveTypeId()
      const employeeId = employee.id
      const entitlement = resolveAnnualLeaveEntitlement(employee, new Date()).totalDays
      const requestedUnits = 6

      const request = await createLeaveRequest({
        employeeId,
        leaveTypeId: annualLeaveTypeId,
        startDate: new Date(),
        endDate: new Date(),
        requestedUnits,
        status: "PENDING_APPROVAL",
      })
      createdRequestIds.push(request.id)

      await cancelLeaveRequest(request.id, "Withdrawn by employee")

      const state = await computeLeaveBalance(employeeId, annualLeaveTypeId)
      expect(state.pending).toBe(0)
      expect(state.taken).toBe(0)
      expect(state.remaining).toBe(entitlement)
    })
  })
})

describe("createApprovedLeaveRequest — status, ledger, and audit written together", () => {
  it("writes the request (APPROVED), its LEAVE_TAKEN ledger entry, and an audit entry in one call", async () => {
    await withTestEmployee("EMP-1040", async (employee) => {
      const annualLeaveTypeId = await findAnnualLeaveTypeId()
      const requestedUnits = 8

      const { leaveRequest } = await createApprovedLeaveRequest({
        employeeId: employee.id,
        leaveTypeId: annualLeaveTypeId,
        startDate: new Date(),
        endDate: new Date(),
        requestedUnits,
      })
      createdRequestIds.push(leaveRequest.id)

      expect(leaveRequest.status).toBe("APPROVED")
      expect(leaveRequest.decidedBy).toBe("HR")
      expect(leaveRequest.decidedAt).not.toBeNull()

      const ledgerEntries = await prisma.leaveLedgerEntry.findMany({
        where: { referenceType: "LEAVE_REQUEST", referenceId: leaveRequest.id },
      })
      expect(ledgerEntries).toHaveLength(1)
      expect(ledgerEntries[0].entryType).toBe("LEAVE_TAKEN")
      expect(ledgerEntries[0].amount).toBe(-requestedUnits)

      const auditEntries = await findLeaveAuditLogEntriesForEntity("LEAVE_REQUEST", leaveRequest.id)
      expect(auditEntries.some((entry) => entry.action === "leave_request.created")).toBe(true)

      // The balance reflects the ledger entry immediately — this was the
      // whole point of merging creation and approval into one step.
      const balance = await computeLeaveBalance(employee.id, annualLeaveTypeId)
      expect(balance.taken).toBe(requestedUnits)
    })
  })
})

describe("updateLeaveRequestDecisionIfStatusIn — the compare-and-swap cancelLeaveRequest relies on", () => {
  it("writes nothing and returns null when the row's current status doesn't match what's expected", async () => {
    await withTestEmployee("EMP-0345", async (employee) => {
      const annualLeaveTypeId = await findAnnualLeaveTypeId()
      const request = await createLeaveRequest({
        employeeId: employee.id,
        leaveTypeId: annualLeaveTypeId,
        startDate: new Date(),
        endDate: new Date(),
        requestedUnits: 2,
        status: "APPROVED",
        decidedBy: "HR",
        decidedAt: new Date(),
      })
      createdRequestIds.push(request.id)

      // The row is APPROVED, not PENDING_APPROVAL — this simulates a second
      // caller losing a race against a decision that already landed.
      const result = await updateLeaveRequestDecisionIfStatusIn(request.id, ["PENDING_APPROVAL"], {
        status: "CANCELLED",
        cancelledBy: "HR",
        cancelledAt: new Date(),
      })
      expect(result).toBeNull()

      const unchanged = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: request.id } })
      expect(unchanged.status).toBe("APPROVED")
    })
  })

  it("updates and returns the row when the current status does match", async () => {
    await withTestEmployee("EMP-0764", async (employee) => {
      const annualLeaveTypeId = await findAnnualLeaveTypeId()
      const request = await createLeaveRequest({
        employeeId: employee.id,
        leaveTypeId: annualLeaveTypeId,
        startDate: new Date(),
        endDate: new Date(),
        requestedUnits: 2,
        status: "APPROVED",
        decidedBy: "HR",
        decidedAt: new Date(),
      })
      createdRequestIds.push(request.id)

      const result = await updateLeaveRequestDecisionIfStatusIn(request.id, ["APPROVED"], {
        status: "CANCELLED",
        cancelledBy: "HR",
        cancelledAt: new Date(),
        cancelReason: "test",
      })
      expect(result?.status).toBe("CANCELLED")
      expect(result?.cancelReason).toBe("test")
    })
  })

  it("a second cancelLeaveRequest call on an already-cancelled request throws instead of writing a second reversal", async () => {
    await withTestEmployee("EMP-0193", async (employee) => {
      const annualLeaveTypeId = await findAnnualLeaveTypeId()
      const requestedUnits = 5
      const { leaveRequest } = await createApprovedLeaveRequest({
        employeeId: employee.id,
        leaveTypeId: annualLeaveTypeId,
        startDate: new Date(),
        endDate: new Date(),
        requestedUnits,
      })
      createdRequestIds.push(leaveRequest.id)

      await cancelLeaveRequest(leaveRequest.id, "first cancel")
      await expect(cancelLeaveRequest(leaveRequest.id, "second cancel")).rejects.toThrow()

      // Exactly one reversing entry, not two — a second blind write here
      // would have silently over-credited the balance.
      const cancelledEntries = await prisma.leaveLedgerEntry.findMany({
        where: { referenceType: "LEAVE_REQUEST", referenceId: leaveRequest.id, entryType: "LEAVE_CANCELLED" },
      })
      expect(cancelledEntries).toHaveLength(1)
    })
  })
})
