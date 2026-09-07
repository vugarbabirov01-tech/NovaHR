import type { EmploymentStatus } from "@/types/employee-profile"

export interface EmployeeFilters {
  search: string
  company: string
  workLocation: string
  department: string
  position: string
  manager: string
  employmentType: string
  employmentStatus: string
  /** Active Smart Filter id (see employee-smart-filters.ts), or "" for none.
   * Intersects with every filter above rather than replacing them. */
  smartFilter: string
}

export const ALL_VALUE = "all"

/**
 * The status filter's own default sentinel — distinct from ALL_VALUE.
 * ALL_VALUE means literally every EmploymentStatus, including Terminated/
 * Suspended/Inactive. DEFAULT_STATUS_FILTER means "the normal
 * working-employee view": Active, Probation. Terminated/Suspended/Inactive
 * only ever show up when explicitly filtered for. This is about
 * EmploymentStatus only — whether someone is at their desk right now
 * (WorkStatus) is a separate axis and isn't filtered here.
 */
export const DEFAULT_STATUS_FILTER = "default"

export const DEFAULT_VISIBLE_STATUSES: EmploymentStatus[] = ["active", "probation"]

export const defaultEmployeeFilters: EmployeeFilters = {
  search: "",
  company: ALL_VALUE,
  workLocation: ALL_VALUE,
  department: ALL_VALUE,
  position: ALL_VALUE,
  manager: ALL_VALUE,
  employmentType: ALL_VALUE,
  employmentStatus: DEFAULT_STATUS_FILTER,
  smartFilter: "",
}

export type EmployeeView = "card" | "list"

export type EmployeeGroupBy = "none" | "workLocation" | "department" | "manager"
