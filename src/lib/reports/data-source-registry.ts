import { fetchEmployeeReportRows } from "@/lib/reports/employees-report-data-source"
import {
  fetchBranchReportRows,
  fetchCompanyReportRows,
  fetchDepartmentReportRows,
  fetchPositionReportRows,
} from "@/lib/reports/organization-report-data-source"
import { fetchLeaveRequestReportRows } from "@/lib/reports/leave-report-data-source"
import { fetchPayrollReportRows } from "@/lib/reports/payroll-report-data-source"
import type { ReportDataSourceKey, ReportRow } from "@/types/reports"

/**
 * The one place a new data source is registered — report-execution-
 * service.ts only ever calls fetchRowsForDataSource below, never any of
 * these functions directly, so adding a source never means touching the
 * filter/sort/paginate/export pipeline itself.
 */
const FETCHERS: Record<ReportDataSourceKey, () => Promise<ReportRow[]>> = {
  EMPLOYEES: fetchEmployeeReportRows,
  COMPANIES: fetchCompanyReportRows,
  BRANCHES: fetchBranchReportRows,
  DEPARTMENTS: fetchDepartmentReportRows,
  POSITIONS: fetchPositionReportRows,
  LEAVE_REQUESTS: fetchLeaveRequestReportRows,
  PAYROLL: fetchPayrollReportRows,
}

export function fetchRowsForDataSource(dataSource: ReportDataSourceKey): Promise<ReportRow[]> {
  return FETCHERS[dataSource]()
}
