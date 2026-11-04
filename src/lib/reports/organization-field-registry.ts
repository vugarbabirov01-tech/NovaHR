import type { ReportFieldDefinition } from "@/lib/reports/field-registry"

/**
 * Four separate data sources (Company/Branch/Department/Position), each at
 * its own grain — one row per organizational unit, never per employee.
 * Every field key is prefixed by its own entity on purpose (companyName,
 * branchName, departmentName, ... — never a bare "name") so these can
 * never collide with EMPLOYEE_REPORT_FIELDS' own company/branch/department/
 * position keys, which mean something different (the employee's own
 * denormalized assignment, not the master-data record itself).
 *
 * employeeCount's reliability differs by entity — see
 * organization-report-data-source.ts's own comment: Branch matches by the
 * real branchId relation (reliable), Company/Department/Position match by
 * name only (Employee has no companyId/departmentId/positionId — see
 * employee-profile.ts), so a rename in Administration that hasn't also
 * been re-saved on affected employees will under-count there until it is.
 */

export const ORGANIZATION_COMPANY_FIELDS: ReportFieldDefinition[] = [
  { key: "companyName", category: "organization", type: "string", labelKey: "companyName", dataSource: "COMPANIES" },
  { key: "companyCode", category: "organization", type: "string", labelKey: "companyCode", dataSource: "COMPANIES" },
  {
    key: "companyEmployeeCount",
    category: "organization",
    type: "number",
    labelKey: "companyEmployeeCount",
    dataSource: "COMPANIES",
  },
]

export const ORGANIZATION_BRANCH_FIELDS: ReportFieldDefinition[] = [
  { key: "branchName", category: "organization", type: "string", labelKey: "branchName", dataSource: "BRANCHES" },
  { key: "branchCode", category: "organization", type: "string", labelKey: "branchCode", dataSource: "BRANCHES" },
  {
    key: "branchCompanyName",
    category: "organization",
    type: "string",
    labelKey: "branchCompanyName",
    dataSource: "BRANCHES",
  },
  {
    key: "branchEmployeeCount",
    category: "organization",
    type: "number",
    labelKey: "branchEmployeeCount",
    dataSource: "BRANCHES",
  },
]

export const ORGANIZATION_DEPARTMENT_FIELDS: ReportFieldDefinition[] = [
  {
    key: "departmentName",
    category: "organization",
    type: "string",
    labelKey: "departmentName",
    dataSource: "DEPARTMENTS",
  },
  {
    key: "departmentCode",
    category: "organization",
    type: "string",
    labelKey: "departmentCode",
    dataSource: "DEPARTMENTS",
  },
  {
    key: "departmentEmployeeCount",
    category: "organization",
    type: "number",
    labelKey: "departmentEmployeeCount",
    dataSource: "DEPARTMENTS",
  },
]

export const ORGANIZATION_POSITION_FIELDS: ReportFieldDefinition[] = [
  { key: "positionTitle", category: "organization", type: "string", labelKey: "positionTitle", dataSource: "POSITIONS" },
  { key: "positionCode", category: "organization", type: "string", labelKey: "positionCode", dataSource: "POSITIONS" },
  {
    key: "positionDepartmentName",
    category: "organization",
    type: "string",
    labelKey: "positionDepartmentName",
    dataSource: "POSITIONS",
  },
  {
    key: "positionEmployeeCount",
    category: "organization",
    type: "number",
    labelKey: "positionEmployeeCount",
    dataSource: "POSITIONS",
  },
]
