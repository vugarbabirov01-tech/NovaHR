import { afterEach, describe, expect, it } from "vitest"

import { prisma } from "@/lib/prisma"
import { computeLeaveBalance, getOrganizationLeaveDaysSummary } from "@/lib/leave/leave-balance-service"
import { findActiveLeaveTypes } from "@/repositories/leave-type-repository"
import { createLeaveRequest } from "@/repositories/leave-request-repository"
import { createLeaveLedgerEntry } from "@/repositories/leave-ledger-repository"
import { resolveAnnualLeaveEntitlement } from "@/lib/leave/leave-policy-resolution-service"
import { withTestEmployee } from "@/lib/leave/leave-test-fixtures"

// "Upcoming" tests below create their own fixture rather than reading
// whatever real requests happen to exist for a given employee — an earlier
// version of this file asserted against a specific real employee's live
// PENDING_APPROVAL request, which broke the moment that request was
// actually decided. Real, user-mutable data is not a fixture. Cleanup goes
// through Prisma directly since LeaveLedgerEntry has no delete function at
// the repository layer by design (append-only). The employee itself is a
// separate, per-test throwaway fixture (withTestEmployee, leave-test-
// fixtures.ts) — these tests never read or depend on a real HR record.
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
 *  - A future-dated APPROVED request not being visible as "what's coming
 *    up" anywhere, despite already having reduced Remaining the moment it
 *    was created (see sumUpcomingApprovedUnits — there's no separate
 *    PENDING_APPROVAL decision step anymore, so "pending" now means
 *    "scheduled", not "undecided")
 */
describe("computeLeaveBalance — Annual Leave entitlement fallback", () => {
  it("never returns a stored -0 for any bucket when the ledger has zero activity", async () => {
    await withTestEmployee("EMP-1042", async (employee) => {
      const annual = (await findActiveLeaveTypes()).find((t) => t.code === "ANNUAL")
      expect(annual).toBeDefined()

      const balance = await computeLeaveBalance(employee.id, annual!.id, new Date("2026-08-03"))

      for (const [key, value] of Object.entries(balance)) {
        if (typeof value !== "number") continue
        expect(Object.is(value, -0), `${key} must not be stored as -0`).toBe(false)
      }
      expect(balance.taken).toBe(0)
    })
  })

  it("falls back to the employee's computed entitlement when no opening-balance ledger row exists", async () => {
    await withTestEmployee("EMP-1042", async (employee) => {
      const annual = (await findActiveLeaveTypes()).find((t) => t.code === "ANNUAL")
      expect(annual).toBeDefined()

      const asOfDate = new Date("2026-08-03")
      const balance = await computeLeaveBalance(employee.id, annual!.id, asOfDate)
      const expectedEntitlement = resolveAnnualLeaveEntitlement(employee, asOfDate).totalDays

      expect(expectedEntitlement).toBeGreaterThan(0)
      expect(balance.opening).toBe(expectedEntitlement)
      // remaining must move together with opening — showing a non-zero
      // Initial Balance next to a 0 Current Balance (with nothing taken) is
      // exactly the inconsistent-dashboard state the fix must not produce.
      expect(balance.remaining).toBe(expectedEntitlement)
    })
  })

  it("does not apply the entitlement fallback to a non-Annual leave type", async () => {
    await withTestEmployee("EMP-1042", async (employee) => {
      const unpaid = (await findActiveLeaveTypes()).find((t) => t.code === "UNPAID")
      expect(unpaid).toBeDefined()

      const balance = await computeLeaveBalance(employee.id, unpaid!.id, new Date("2026-08-03"))
      expect(balance.opening).toBe(0)
      expect(balance.remaining).toBe(0)
    })
  })

  it("surfaces a future-dated APPROVED request as 'pending' while it has already reduced Remaining", async () => {
    await withTestEmployee("EMP-0522", async (employee) => {
      const annual = (await findActiveLeaveTypes()).find((t) => t.code === "ANNUAL")
      expect(annual).toBeDefined()
      const employeeId = employee.id
      const requestedUnits = 46
      const asOfDate = new Date()
      const future = new Date(asOfDate)
      future.setDate(future.getDate() + 30)

      const baseline = await computeLeaveBalance(employeeId, annual!.id, asOfDate)

      // Mirrors exactly what submitLeaveRequestAction does for a real HR-
      // entered leave: create it straight into APPROVED and write its
      // LEAVE_TAKEN ledger entry in the same step — there's no separate
      // decision afterward that would write it instead.
      const request = await createLeaveRequest({
        employeeId,
        leaveTypeId: annual!.id,
        startDate: future,
        endDate: future,
        requestedUnits,
        status: "APPROVED",
        decidedBy: "HR",
        decidedAt: asOfDate,
      })
      createdRequestIds.push(request.id)
      await createLeaveLedgerEntry({
        employeeId,
        leaveTypeId: annual!.id,
        companyId: null,
        entryType: "LEAVE_TAKEN",
        amount: -requestedUnits,
        unit: annual!.unit,
        effectiveDate: asOfDate,
        referenceType: "LEAVE_REQUEST",
        referenceId: request.id,
        createdBy: "HR",
      })

      const balance = await computeLeaveBalance(employeeId, annual!.id, asOfDate)
      expect(balance.pending).toBe(requestedUnits)
      // Unlike the old PENDING_APPROVAL rule, this request's ledger entry
      // already exists — Remaining must already be down by requestedUnits,
      // not still equal to opening.
      expect(balance.remaining).toBe(baseline.remaining - requestedUnits)
    })
  })
})

describe("getOrganizationLeaveDaysSummary — single source of truth with the per-employee balance", () => {
  it("aggregates the same entitlement-aware, upcoming-aware figures computeLeaveBalance produces", async () => {
    await withTestEmployee("EMP-0193", async (employee) => {
      const annual = (await findActiveLeaveTypes()).find((t) => t.code === "ANNUAL")
      expect(annual).toBeDefined()
      const employeeId = employee.id
      const requestedUnits = 12
      const asOfDate = new Date()
      const future = new Date(asOfDate)
      future.setDate(future.getDate() + 30)

      const request = await createLeaveRequest({
        employeeId,
        leaveTypeId: annual!.id,
        startDate: future,
        endDate: future,
        requestedUnits,
        status: "APPROVED",
        decidedBy: "HR",
        decidedAt: asOfDate,
      })
      createdRequestIds.push(request.id)
      await createLeaveLedgerEntry({
        employeeId,
        leaveTypeId: annual!.id,
        companyId: null,
        entryType: "LEAVE_TAKEN",
        amount: -requestedUnits,
        unit: annual!.unit,
        effectiveDate: asOfDate,
        referenceType: "LEAVE_REQUEST",
        referenceId: request.id,
        createdBy: "HR",
      })

      const [org, employeeBalance] = await Promise.all([
        getOrganizationLeaveDaysSummary(asOfDate),
        computeLeaveBalance(employeeId, annual!.id, asOfDate),
      ])

      // The org total isn't a separately-maintained figure — it must be at
      // least as large as any one employee's contribution, and it must
      // reflect this same upcoming-leave request computeLeaveBalance sees.
      expect(org.totalOpeningBalance).toBeGreaterThanOrEqual(employeeBalance.opening)
      expect(org.totalPending).toBeGreaterThanOrEqual(requestedUnits)
      expect(Object.is(org.totalOpeningBalance, -0)).toBe(false)
      expect(Object.is(org.totalTaken, -0)).toBe(false)
    })
  })
})
