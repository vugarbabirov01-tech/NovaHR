import type { ReportDataSourceKey } from "@/types/reports"

/**
 * Deliberately its own file, separate from data-source-registry.ts —
 * that module's FETCHERS map pulls in every repository (Prisma, and
 * through it Node's fs/events), which a "use client" component can never
 * import. This file has zero such imports, so the data-source SELECTOR
 * (client) can read it safely while report-execution-service.ts (server)
 * reads the FETCHERS map from the other file — same labelKey strings,
 * two files split purely along the client/server boundary.
 */
export const DATA_SOURCE_LABEL_KEYS: Record<ReportDataSourceKey, string> = {
  EMPLOYEES: "dataSourceEmployees",
  COMPANIES: "dataSourceCompanies",
  BRANCHES: "dataSourceBranches",
  DEPARTMENTS: "dataSourceDepartments",
  POSITIONS: "dataSourcePositions",
  LEAVE_REQUESTS: "dataSourceLeaveRequests",
  PAYROLL: "dataSourcePayroll",
}
