import { findAllPayrollEmployeeRecordsWithPeriod } from "@/repositories/payroll-repository"
import { findAllEmployees } from "@/repositories/employee-repository"
import { getFullName } from "@/lib/employees"
import { isDataSourceAvailable } from "@/types/reports"
import type { ReportRow } from "@/types/reports"

/**
 * Dev-only runtime guard — isDataSourceAvailable("PAYROLL") is the single
 * source of truth both the client-side data-source selector and this
 * server-side fetch agree on (see that function's own comment), so the
 * two can never drift: a selector that somehow still offered PAYROLL in
 * production would still get nothing back from here. No financial field
 * is read regardless of environment — see payroll-field-registry.ts.
 */
export async function fetchPayrollReportRows(): Promise<ReportRow[]> {
  if (!isDataSourceAvailable("PAYROLL")) return []

  const [records, employees] = await Promise.all([findAllPayrollEmployeeRecordsWithPeriod(), findAllEmployees()])

  const employeeContextById = new Map(
    employees.map((employee) => [
      employee.id,
      {
        name: getFullName(employee.personal),
        department: employee.employment.department ?? "",
        company: employee.employment.company ?? "",
      },
    ])
  )

  return records.map((record) => {
    const context = employeeContextById.get(record.employeeId)
    return {
      payrollYear: record.payrollPeriod.year,
      payrollMonth: record.payrollPeriod.month,
      payrollStatus: record.status,
      payrollEmployeeName: context?.name ?? "",
      payrollEmployeeDepartment: context?.department ?? "",
      payrollEmployeeCompany: context?.company ?? "",
    }
  })
}
