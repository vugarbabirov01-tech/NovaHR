import { getFullLegalName } from "@/lib/employees"
import type { PayrollEmployeeRecord } from "@/repositories/payroll-repository"
import type { EmployeeProfile } from "@/types/employee-profile"
import type { PayrollAdjustmentView, PayrollEmployeeRow, PayrollPeriodStatus } from "@/types/payroll"

/**
 * Joins a period's PayrollEmployeeRecords with each employee's current
 * display fields. Shared by the payroll page and the Excel export so both
 * always show the same rows. Records whose employee no longer exists are
 * dropped; result is sorted by full name.
 */
export function buildPayrollRows(
  records: PayrollEmployeeRecord[],
  employees: EmployeeProfile[],
  adjustments: Array<{ id: string; recordId: string; kind: string; category: string; amount: number; note: string }> = []
): PayrollEmployeeRow[] {
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]))
  const adjustmentsByRecord = new Map<string, PayrollAdjustmentView[]>()
  for (const adjustment of adjustments) {
    const list = adjustmentsByRecord.get(adjustment.recordId) ?? []
    list.push({
      id: adjustment.id,
      kind: adjustment.kind === "DEDUCTION" ? "DEDUCTION" : "ADDITION",
      category: adjustment.category,
      amount: adjustment.amount,
      note: adjustment.note,
    })
    adjustmentsByRecord.set(adjustment.recordId, list)
  }

  return records
    .map((record): PayrollEmployeeRow | null => {
      const employee = employeesById.get(record.employeeId)
      if (!employee) return null
      return {
        id: record.id,
        employeeId: employee.id,
        fullName: getFullLegalName(employee.personal),
        firstName: employee.personal.firstName,
        lastName: employee.personal.lastName,
        finCode: employee.personal.finCode,
        company: employee.employment.company,
        workLocation: employee.employment.workLocation,
        position: employee.employment.position,
        photoUrl: employee.personal.photoUrl,
        baseSalary: record.baseSalary,
        grossSalary: employee.payroll.grossSalary,
        currency: record.currency,
        additions: record.additions,
        deductions: record.deductions,
        grossAmount: record.grossAmount,
        netAmount: record.netAmount,
        status: record.status as PayrollPeriodStatus,
        salaryHistory: employee.employment.history
          .filter((event) => event.type === "salary-change")
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 5)
          .map((event) => ({ date: event.date, title: event.title })),
        adjustments: adjustmentsByRecord.get(record.id) ?? [],
      }
    })
    .filter((row): row is PayrollEmployeeRow => row !== null)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
}
