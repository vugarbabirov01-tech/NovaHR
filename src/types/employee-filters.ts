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
}

export const ALL_VALUE = "all"

export const defaultEmployeeFilters: EmployeeFilters = {
  search: "",
  company: ALL_VALUE,
  branch: ALL_VALUE,
  workLocation: ALL_VALUE,
  department: ALL_VALUE,
  position: ALL_VALUE,
  manager: ALL_VALUE,
  employmentType: ALL_VALUE,
  employmentStatus: ALL_VALUE,
}

export type EmployeeView = "card" | "list"

export type EmployeeGroupBy = "none" | "workLocation" | "department" | "manager"
