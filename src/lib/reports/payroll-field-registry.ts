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
    groupable: true,
  },
  {
    key: "payrollEmployeeCompany",
    category: "payroll",
    type: "string",
    labelKey: "payrollEmployeeCompany",
    dataSource: "PAYROLL",
    groupable: true,
  },
]

// Deliberately no `aggregations` anywhere in this file: payrollYear/
// payrollMonth are numeric identifiers (never a measure), and the 2026-11-
// 11 decision keeps every actual financial field out of this registry
// entirely until real RBAC exists (see this file's own header comment).
// This means the universal analytics engine can only ever offer "count" —
// never sum/avg/min/max of anything — for this data source, which is
// exactly the intended restriction, enforced by metadata rather than a
// special case anywhere in the engine or UI.
