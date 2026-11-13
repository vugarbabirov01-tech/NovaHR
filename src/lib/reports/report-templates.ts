import type { AnalyticsSpec, ReportDataSourceKey, ReportFilter } from "@/types/reports"

/**
 * Ready-made reports shown in the Reports hub. Code-defined recipes — not
 * database rows — so they ship with the app, can't be deleted, and never
 * need a migration. Opening one pre-fills the builder in "create" mode: the
 * user can run it as-is or tweak it, and saving creates their own copy.
 *
 * Deliberately NO salary/payroll templates: those wait for real
 * authentication + permissions (see field-registry.ts, EMPLOYEE_REPORT_FIELDS).
 *
 * Display text lives in messages under Reports.templates.<id>.{name,description}
 * and Reports.templateCategories.<category>.
 */

export type ReportTemplateCategory = "employees" | "tenure" | "leave" | "organization"

export const REPORT_TEMPLATE_CATEGORIES: ReportTemplateCategory[] = ["employees", "tenure", "leave", "organization"]

export interface ReportTemplate {
  id: string
  category: ReportTemplateCategory
  dataSource: ReportDataSourceKey
  columns: string[]
  filters: ReportFilter[]
  sortBy: string | null
  sortDirection: "asc" | "desc"
  kpis: AnalyticsSpec[]
  chartConfig: AnalyticsSpec | null
}

const PEOPLE_COLUMNS = ["employeeNumber", "fullName", "workLocation", "position"]

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "employeeList",
    category: "employees",
    dataSource: "EMPLOYEES",
    columns: [...PEOPLE_COLUMNS, "hireDate"],
    filters: [],
    sortBy: "fullName",
    sortDirection: "asc",
    kpis: [],
    chartConfig: null,
  },
  {
    id: "headcountByDepartment",
    category: "employees",
    dataSource: "EMPLOYEES",
    columns: ["fullName", "department", "position"],
    filters: [],
    sortBy: "department",
    sortDirection: "asc",
    kpis: [],
    chartConfig: {
      aggregation: "count",
      groupBy: { field: "department", bucket: "category", chartType: "bar" },
    },
  },
  {
    id: "headcountByWorkLocation",
    category: "employees",
    dataSource: "EMPLOYEES",
    columns: ["fullName", "workLocation", "position"],
    filters: [],
    sortBy: "workLocation",
    sortDirection: "asc",
    kpis: [],
    chartConfig: {
      aggregation: "count",
      groupBy: { field: "workLocation", bucket: "category", chartType: "bar" },
    },
  },
  {
    id: "employmentTypeBreakdown",
    category: "employees",
    dataSource: "EMPLOYEES",
    columns: ["fullName", "workLocation", "employmentType", "contractType"],
    filters: [],
    sortBy: "fullName",
    sortDirection: "asc",
    kpis: [],
    chartConfig: {
      aggregation: "count",
      groupBy: { field: "employmentType", bucket: "category", chartType: "pie" },
    },
  },
  {
    id: "genderBreakdown",
    category: "employees",
    dataSource: "EMPLOYEES",
    columns: ["fullName", "gender", "workLocation"],
    filters: [],
    sortBy: "fullName",
    sortDirection: "asc",
    kpis: [{ aggregation: "avg", valueField: "age" }],
    chartConfig: {
      aggregation: "count",
      groupBy: { field: "gender", bucket: "category", chartType: "pie" },
    },
  },
  {
    id: "ageDistribution",
    category: "employees",
    dataSource: "EMPLOYEES",
    columns: ["fullName", "dateOfBirth", "age", "workLocation"],
    filters: [],
    sortBy: "age",
    sortDirection: "desc",
    kpis: [
      { aggregation: "avg", valueField: "age" },
      { aggregation: "min", valueField: "age" },
      { aggregation: "max", valueField: "age" },
    ],
    chartConfig: {
      aggregation: "count",
      groupBy: { field: "age", bucket: "interval", bucketCount: 8, chartType: "bar" },
    },
  },
  {
    id: "hiredThisYear",
    category: "employees",
    dataSource: "EMPLOYEES",
    columns: [...PEOPLE_COLUMNS, "hireDate"],
    filters: [{ field: "hireDate", operator: "thisYear" }],
    sortBy: "hireDate",
    sortDirection: "desc",
    kpis: [],
    chartConfig: {
      aggregation: "count",
      groupBy: { field: "hireDate", bucket: "month", chartType: "bar" },
    },
  },
  {
    id: "hiredLastYear",
    category: "employees",
    dataSource: "EMPLOYEES",
    columns: [...PEOPLE_COLUMNS, "hireDate"],
    filters: [{ field: "hireDate", operator: "lastYear" }],
    sortBy: "hireDate",
    sortDirection: "desc",
    kpis: [],
    chartConfig: {
      aggregation: "count",
      groupBy: { field: "hireDate", bucket: "month", chartType: "bar" },
    },
  },
  {
    id: "tenureDistribution",
    category: "tenure",
    dataSource: "EMPLOYEES",
    columns: ["fullName", "workLocation", "hireDate", "tenureDurationMonths"],
    filters: [],
    sortBy: "tenureDurationMonths",
    sortDirection: "desc",
    kpis: [{ aggregation: "avg", valueField: "tenureDurationMonths" }],
    chartConfig: {
      aggregation: "count",
      groupBy: { field: "tenureDurationMonths", bucket: "interval", bucketCount: 8, chartType: "bar" },
    },
  },
  {
    id: "longestServing",
    category: "tenure",
    dataSource: "EMPLOYEES",
    columns: ["fullName", "workLocation", "position", "hireDate", "tenureDurationMonths"],
    filters: [],
    sortBy: "tenureDurationMonths",
    sortDirection: "desc",
    kpis: [{ aggregation: "max", valueField: "tenureDurationMonths" }],
    chartConfig: null,
  },
  {
    id: "newcomers",
    category: "tenure",
    dataSource: "EMPLOYEES",
    columns: ["fullName", "workLocation", "position", "hireDate", "probationEndDate"],
    filters: [{ field: "hireDate", operator: "thisYear" }],
    sortBy: "hireDate",
    sortDirection: "desc",
    kpis: [],
    chartConfig: null,
  },
  {
    id: "leaveByType",
    category: "leave",
    dataSource: "LEAVE_REQUESTS",
    columns: ["leaveEmployeeName", "leaveTypeName", "leaveStartDate", "leaveEndDate", "leaveRequestedUnits", "leaveStatus"],
    filters: [],
    sortBy: "leaveStartDate",
    sortDirection: "desc",
    kpis: [{ aggregation: "sum", valueField: "leaveRequestedUnits" }],
    chartConfig: {
      aggregation: "count",
      groupBy: { field: "leaveTypeName", bucket: "category", chartType: "bar" },
    },
  },
  {
    id: "leaveThisYear",
    category: "leave",
    dataSource: "LEAVE_REQUESTS",
    columns: ["leaveEmployeeName", "leaveEmployeeDepartment", "leaveTypeName", "leaveStartDate", "leaveEndDate", "leaveRequestedUnits", "leaveStatus"],
    filters: [{ field: "leaveStartDate", operator: "thisYear" }],
    sortBy: "leaveStartDate",
    sortDirection: "desc",
    kpis: [{ aggregation: "sum", valueField: "leaveRequestedUnits" }],
    chartConfig: {
      aggregation: "sum",
      valueField: "leaveRequestedUnits",
      groupBy: { field: "leaveStartDate", bucket: "month", chartType: "bar" },
    },
  },
  {
    id: "departmentsOverview",
    category: "organization",
    dataSource: "DEPARTMENTS",
    columns: ["departmentName", "departmentCode", "departmentEmployeeCount"],
    filters: [],
    sortBy: "departmentEmployeeCount",
    sortDirection: "desc",
    kpis: [{ aggregation: "sum", valueField: "departmentEmployeeCount" }],
    chartConfig: null,
  },
  {
    id: "positionsOverview",
    category: "organization",
    dataSource: "POSITIONS",
    columns: ["positionTitle", "positionDepartmentName", "positionEmployeeCount"],
    filters: [],
    sortBy: "positionEmployeeCount",
    sortDirection: "desc",
    kpis: [],
    chartConfig: null,
  },
]

export function findReportTemplate(id: string): ReportTemplate | undefined {
  return REPORT_TEMPLATES.find((template) => template.id === id)
}
