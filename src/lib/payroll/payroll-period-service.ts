import { prisma } from "@/lib/prisma"
import {
  createPayrollEmployeeRecords,
  createPayrollPeriod,
  findPayrollEmployeeRecords,
  findPayrollPeriod,
  type PayrollEmployeeRecord,
  type PayrollPeriod,
} from "@/repositories/payroll-repository"
import { findAllEmployees } from "@/repositories/employee-repository"
import { computeGrossAmount, computeNetAmount } from "@/lib/payroll/payroll-calculations"
import { DEFAULT_TENANT_ID } from "@/lib/payroll/constants"

function monthBounds(year: number, month: number): { startDate: Date; endDate: Date } {
  // month is 1-12. Day 0 of the next month is the last day of this one —
  // the standard JS-Date way to get a calendar month's real end date
  // (28/29/30/31) without a lookup table.
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { startDate, endDate }
}

export interface PayrollPeriodWithRecords {
  period: PayrollPeriod
  records: PayrollEmployeeRecord[]
}

/**
 * Finds this month's PayrollPeriod or creates it (status DRAFT), then makes
 * sure every currently-ACTIVE employee has a PayrollEmployeeRecord in it —
 * snapshotting Employee.payroll.baseSalary/currency at THIS moment for
 * whoever doesn't have one yet. An employee who already has a record is
 * never touched here, on a first visit or the hundredth: that's what keeps
 * a past period's baseSalary frozen even after the employee's real salary
 * later changes, and it's also what lets someone hired mid-cycle be picked
 * up the next time this same period is opened, without disturbing anyone
 * already snapshotted.
 *
 * The whole "who's missing, create theirs" step runs inside one
 * transaction, and createPayrollEmployeeRecords skip-duplicates on top of
 * that — belt and suspenders against a concurrent double-call (React
 * Strict Mode, two tabs opening the same new period at once) ever creating
 * two records for the same employee.
 */
export async function ensurePayrollPeriod(year: number, month: number): Promise<PayrollPeriodWithRecords> {
  return prisma.$transaction(async (tx) => {
    let period = await findPayrollPeriod(DEFAULT_TENANT_ID, year, month, tx)
    if (!period) {
      const { startDate, endDate } = monthBounds(year, month)
      period = await createPayrollPeriod({ tenantId: DEFAULT_TENANT_ID, year, month, startDate, endDate }, tx)
    }

    const existingRecords = await findPayrollEmployeeRecords(period.id, tx)
    const employeeIdsWithRecords = new Set(existingRecords.map((record) => record.employeeId))

    const employees = await findAllEmployees(tx)
    const missingRows = employees
      .filter((employee) => employee.employmentStatus === "active" && !employeeIdsWithRecords.has(employee.id))
      .map((employee) => {
        const baseSalary = employee.payroll.baseSalary
        const grossAmount = computeGrossAmount(baseSalary, 0)
        const netAmount = computeNetAmount(grossAmount, 0)
        return {
          payrollPeriodId: period!.id,
          employeeId: employee.id,
          baseSalary,
          currency: employee.payroll.currency,
          additions: 0,
          deductions: 0,
          grossAmount,
          netAmount,
        }
      })

    if (missingRows.length > 0) {
      await createPayrollEmployeeRecords(missingRows, tx)
    }

    const records = missingRows.length > 0 ? await findPayrollEmployeeRecords(period.id, tx) : existingRecords
    return { period, records }
  })
}
