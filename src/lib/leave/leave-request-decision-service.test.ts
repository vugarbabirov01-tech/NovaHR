import { afterEach, describe, expect, it } from "vitest"

import { prisma } from "@/lib/prisma"
import { createLeaveRequest } from "@/repositories/leave-request-repository"
import { findActiveLeaveTypes } from "@/repositories/leave-type-repository"
import { computeLeaveBalance } from "@/lib/leave/leave-balance-service"
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
} from "@/lib/leave/leave-request-decision-service"
import { resolveAnnualLeaveEntitlement } from "@/lib/leave/leave-policy-resolution-service"
import { getEmployeeById } from "@/data/employee-directory"

/**
 * Regression coverage for the exact scenario in the bug report:
 *   Initial = entitlement, Pending = requested, Used = 0, Current = Initial
 *   -> approve -> Pending = 0, Used = requested, Current = Initial - requested
 *   -> (separately, from the same starting point) reject -> everything back
 *      to the pre-request baseline
 *
 * Each test creates its own PENDING_APPROVAL request against an employee
 * untouched by any other test in this suite (so pending/ledger totals start
 * clean) and tears down everything it wrote in afterEach — LeaveLedgerEntry
 * has no delete function at the repository layer by design (append-only),
 * so cleanup goes through Prisma directly, same as this session's own
 * manual verification scripts did.
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
    const annualLeaveTypeId = await findAnnualLeaveTypeId()
    const employeeId = "EMP-1039"
    const employee = getEmployeeById(employeeId)
    expect(employee).toBeDefined()
    const entitlement = resolveAnnualLeaveEntitlement(employee!, new Date()).totalDays
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

    // Pending: Initial/Used/Current unchanged, Pending = requested.
    const pendingState = await computeLeaveBalance(employeeId, annualLeaveTypeId)
    expect(pendingState.opening).toBe(entitlement)
    expect(pendingState.pending).toBe(requestedUnits)
    expect(pendingState.taken).toBe(0)
    expect(pendingState.remaining).toBe(entitlement)

    await approveLeaveRequest(request.id)

    // Approved: Pending -> 0, Used -> requested, Current -> Initial - requested.
    const approvedState = await computeLeaveBalance(employeeId, annualLeaveTypeId)
    expect(approvedState.opening).toBe(entitlement)
    expect(approvedState.pending).toBe(0)
    expect(approvedState.taken).toBe(requestedUnits)
    expect(approvedState.remaining).toBe(entitlement - requestedUnits)
  })

  it("refuses to approve a request that isn't PENDING_APPROVAL", async () => {
    const annualLeaveTypeId = await findAnnualLeaveTypeId()
    const employeeId = "EMP-1037"
    const request = await createLeaveRequest({
      employeeId,
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

describe("Leave Request decision flow — Pending -> Rejected", () => {
  it("balances return exactly to the pre-request baseline; Pending returns to 0", async () => {
    const annualLeaveTypeId = await findAnnualLeaveTypeId()
    const employeeId = "EMP-1038"
    const employee = getEmployeeById(employeeId)
    expect(employee).toBeDefined()
    const entitlement = resolveAnnualLeaveEntitlement(employee!, new Date()).totalDays
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

    const pendingState = await computeLeaveBalance(employeeId, annualLeaveTypeId)
    expect(pendingState.pending).toBe(requestedUnits)

    await rejectLeaveRequest(request.id, "Insufficient team coverage")

    const rejectedState = await computeLeaveBalance(employeeId, annualLeaveTypeId)
    expect(rejectedState.opening).toBe(entitlement)
    expect(rejectedState.pending).toBe(0)
    expect(rejectedState.taken).toBe(0)
    expect(rejectedState.remaining).toBe(entitlement)
  })
})

describe("Leave Request decision flow — cancellation", () => {
  it("cancelling an APPROVED request reverses the ledger (LEAVE_CANCELLED) and restores the balance", async () => {
    const annualLeaveTypeId = await findAnnualLeaveTypeId()
    const employeeId = "EMP-0871"
    const employee = getEmployeeById(employeeId)
    expect(employee).toBeDefined()
    const entitlement = resolveAnnualLeaveEntitlement(employee!, new Date()).totalDays
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

  it("cancelling a still-PENDING request needs no ledger reversal — it never wrote one", async () => {
    const annualLeaveTypeId = await findAnnualLeaveTypeId()
    const employeeId = "EMP-1011"
    const employee = getEmployeeById(employeeId)
    expect(employee).toBeDefined()
    const entitlement = resolveAnnualLeaveEntitlement(employee!, new Date()).totalDays
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
