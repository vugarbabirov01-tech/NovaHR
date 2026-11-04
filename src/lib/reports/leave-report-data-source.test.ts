import { describe, expect, it } from "vitest"

import { withTestEmployee } from "@/lib/leave/leave-test-fixtures"
import { createLeaveRequest, deleteLeaveRequestsByEmployees } from "@/repositories/leave-request-repository"
import { findAllLeaveTypes } from "@/repositories/leave-type-repository"
import { fetchLeaveRequestReportRows } from "@/lib/reports/leave-report-data-source"

/**
 * Real-data integration test, same convention as the rest of the Leave
 * suite (single shared dev.db, throwaway employee + throwaway requests,
 * cleaned up in finally) — proves the sensitive-leave-type exclusion is
 * enforced at the data source itself (point 6 of the approved Phase 2
 * plan), not merely in the UI: a SICK request must never appear in these
 * rows under any circumstance, while an ANNUAL request for the same
 * employee, in the same call, correctly does.
 */
describe("fetchLeaveRequestReportRows", () => {
  it("excludes sensitive leave types and includes non-sensitive ones for the same employee", async () => {
    const leaveTypes = await findAllLeaveTypes()
    const annualType = leaveTypes.find((type) => type.code === "ANNUAL")
    const sickType = leaveTypes.find((type) => type.code === "SICK")
    expect(annualType).toBeDefined()
    expect(sickType).toBeDefined()

    await withTestEmployee("EMP-1042", async (employee) => {
      try {
        await createLeaveRequest({
          employeeId: employee.id,
          leaveTypeId: annualType!.id,
          startDate: new Date("2026-03-01"),
          endDate: new Date("2026-03-05"),
          requestedUnits: 5,
          status: "APPROVED",
          decidedBy: "TEST",
        })
        await createLeaveRequest({
          employeeId: employee.id,
          leaveTypeId: sickType!.id,
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-04-02"),
          requestedUnits: 2,
          status: "APPROVED",
          decidedBy: "TEST",
        })

        const rows = await fetchLeaveRequestReportRows()
        const rowsForThisEmployee = rows.filter((row) => row.leaveEmployeeName === `${employee.personal.firstName} ${employee.personal.lastName}`)

        expect(rowsForThisEmployee).toHaveLength(1)
        expect(rowsForThisEmployee[0].leaveTypeName).toBe(annualType!.name)
        expect(rowsForThisEmployee.some((row) => row.leaveTypeName === sickType!.name)).toBe(false)
      } finally {
        await deleteLeaveRequestsByEmployees([employee.id])
      }
    })
  })
})
