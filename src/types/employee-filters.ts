import type { EmploymentStatus } from "@/types/employee-profile"

export interface EmployeeFilters {
  search: string
  company: string
  branch: string
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
 * ALL_VALUE means literally every status, including Terminated/Suspended/
 * Inactive. DEFAULT_STATUS_FILTER means "the normal working-employee view":
 * Active, Probation, On Leave, Business Trip. Terminated (and Suspended/
 * Inactive) only ever show up when explicitly filtered for.
 */
export const DEFAULT_STATUS_FILTER = "default"

export const DEFAULT_VISIBLE_STATUSES: EmploymentStatus[] = ["active", "probation", "on-leave", "business-trip"]

export const defaultEmployeeFilters: EmployeeFilters = {
  search: "",
  company: ALL_VALUE,
  branch: ALL_VALUE,
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
