import type { ReportFieldDefinition } from "@/lib/reports/field-registry"

/**
 * PAYROLL data source — deliberately NO financial fields (baseSalary,
 * additions, deductions, grossAmount, netAmount, currency, bank details).
 * Only period/status/employee-context, so this source answers operational
 * questions ("who is missing from this month's payroll run") without ever
 * exposing a salary figure. See payroll-report-data-source.ts for the
 * additional dev-only runtime guard (isDataSourceAvailable /
 * NODE_ENV !== "production") — this file only controls WHICH fields
 * exist, not WHEN the source is reachable.
 */
export const PAYROLL_FIELDS: ReportFieldDefinition[] = [
  { key: "payrollYear", category: "payroll", type: "number", labelKey: "payrollYear", dataSource: "PAYROLL" },
  { key: "payrollMonth", category: "payroll", type: "number", labelKey: "payrollMonth", dataSource: "PAYROLL" },
  {
    key: "payrollStatus",
    category: "payroll",
    type: "enum",
    labelKey: "payrollStatus",
    dataSource: "PAYROLL",
    enumNamespace: "Payroll.status",
    enumValues: ["DRAFT", "CALCULATED", "APPROVED", "PAID", "CLOSED"],
  },
  {
    key: "payrollEmployeeName",
    category: "payroll",
    type: "string",
    labelKey: "payrollEmployeeName",
    dataSource: "PAYROLL",
  },
  {
    key: "payrollEmployeeDepartment",
    category: "payroll",
    type: "string",
    labelKey: "payrollEmployeeDepartment",
    dataSource: "PAYROLL",
  },
  {
    key: "payrollEmployeeCompany",
    category: "payroll",
    type: "string",
    labelKey: "payrollEmployeeCompany",
    dataSource: "PAYROLL",
  },
]
