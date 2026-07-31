import { afterEach, describe, expect, it } from "vitest"

import { prisma } from "@/lib/prisma"
import { computeLeaveBalance, getOrganizationLeaveDaysSummary } from "@/lib/leave/leave-balance-service"
import { findActiveLeaveTypes } from "@/repositories/leave-type-repository"
import { createLeaveRequest } from "@/repositories/leave-request-repository"
import { resolveAnnualLeaveEntitlement } from "@/lib/leave/leave-policy-resolution-service"
import { getEmployeeById } from "@/data/employee-directory"

// Pending-request tests below create their own fixture rather than reading
// whatever real requests happen to exist for a given employee — an earlier
// version of this file asserted against a specific real employee's live
// PENDING_APPROVAL request, which broke the moment that request was
// actually decided (exactly what a live approval queue is *for*). Real,
// user-mutable data is not a fixture. Cleanup goes through Prisma directly
// since LeaveLedgerEntry has no delete function at the repository layer by
// design (append-only).
const createdRequestIds: string[] = []

afterEach(async () => {
  if (createdRequestIds.length === 0) return
  await prisma.leaveLedgerEntry.deleteMany({
    where: { referenceType: "LEAVE_REQUEST", referenceId: { in: createdRequestIds } },
  })
  await prisma.leaveRequest.deleteMany({ where: { id: { in: createdRequestIds } } })
  createdRequestIds.length = 0
})

/**
 * Regression coverage for the Leave dashboard balance bugs:
 *  - "-0" leaking into the UI (Used Leave)
 *  - Initial Balance always showing 0 instead of the employee's real
 *    Annual Leave entitlement
 *  - Pending requests silently doing nothing visible (no ledger write, but
 *    also no "Pending" figure anywhere) instead of the intended Option A
 *    behavior: pending reserves nothing from Remaining, but IS surfaced as
 *    its own number
 */
describe("computeLeaveBalance — Annual Leave entitlement fallback", () => {
  it("never returns a stored -0 for any bucket when the ledger has zero activity", async () => {
    const annual = (await findActiveLeaveTypes()).find((t) => t.code === "ANNUAL")
    expect(annual).toBeDefined()

    const balance = await computeLeaveBalance("EMP-1042", annual!.id, new Date("2026-08-03"))

    for (const [key, value] of Object.entries(balance)) {
      if (typeof value !== "number") continue
      expect(Object.is(value, -0), `${key} must not be stored as -0`).toBe(false)
    }
    expect(balance.taken).toBe(0)
  })

  it("falls back to the employee's computed entitlement when no opening-balance ledger row exists", async () => {
    const annual = (await findActiveLeaveTypes()).find((t) => t.code === "ANNUAL")
    const employee = getEmployeeById("EMP-1042")
    expect(annual).toBeDefined()
    expect(employee).toBeDefined()

    const asOfDate = new Date("2026-08-03")
    const balance = await computeLeaveBalance("EMP-1042", annual!.id, asOfDate)
    const expectedEntitlement = resolveAnnualLeaveEntitlement(employee!, asOfDate).totalDays

    expect(expectedEntitlement).toBeGreaterThan(0)
    expect(balance.opening).toBe(expectedEntitlement)
    // remaining must move together with opening — showing a non-zero
    // Initial Balance next to a 0 Current Balance (with nothing taken) is
    // exactly the inconsistent-dashboard state the fix must not produce.
    expect(balance.remaining).toBe(expectedEntitlement)
  })

  it("does not apply the entitlement fallback to a non-Annual leave type", async () => {
    const unpaid = (await findActiveLeaveTypes()).find((t) => t.code === "UNPAID")
    expect(unpaid).toBeDefined()

    const balance = await computeLeaveBalance("EMP-1042", unpaid!.id, new Date("2026-08-03"))
    expect(balance.opening).toBe(0)
    expect(balance.remaining).toBe(0)
  })

  it("surfaces a pending request without reducing Remaining (Option A)", async () => {
    const annual = (await findActiveLeaveTypes()).find((t) => t.code === "ANNUAL")
    expect(annual).toBeDefined()
    const employeeId = "EMP-0522"
    const requestedUnits = 46

    const request = await createLeaveRequest({
      employeeId,
      leaveTypeId: annual!.id,
      startDate: new Date(),
      endDate: new Date(),
      requestedUnits,
      status: "PENDING_APPROVAL",
    })
    createdRequestIds.push(request.id)

    const balance = await computeLeaveBalance(employeeId, annual!.id)
    expect(balance.pending).toBe(requestedUnits)
    // Submitting never writes a ledger entry, so remaining must still
    // equal opening (nothing taken, nothing reserved from the ledger).
    expect(balance.remaining).toBe(balance.opening)
  })
})

describe("getOrganizationLeaveDaysSummary — single source of truth with the per-employee balance", () => {
  it("aggregates the same entitlement-aware, pending-aware figures computeLeaveBalance produces", async () => {
    const annual = (await findActiveLeaveTypes()).find((t) => t.code === "ANNUAL")
    expect(annual).toBeDefined()
    const employeeId = "EMP-0193"
    const requestedUnits = 12

    const request = await createLeaveRequest({
      employeeId,
      leaveTypeId: annual!.id,
      startDate: new Date(),
      endDate: new Date(),
      requestedUnits,
      status: "PENDING_APPROVAL",
    })
    createdRequestIds.push(request.id)

    const [org, employeeBalance] = await Promise.all([
      getOrganizationLeaveDaysSummary(),
      computeLeaveBalance(employeeId, annual!.id),
    ])

    // The org total isn't a separately-maintained figure — it must be at
    // least as large as any one employee's contribution, and it must
    // reflect this same pending request computeLeaveBalance sees.
    expect(org.totalOpeningBalance).toBeGreaterThanOrEqual(employeeBalance.opening)
    expect(org.totalPending).toBeGreaterThanOrEqual(requestedUnits)
    expect(Object.is(org.totalOpeningBalance, -0)).toBe(false)
    expect(Object.is(org.totalTaken, -0)).toBe(false)
  })
})
