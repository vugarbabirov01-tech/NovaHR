import {
  ALL_VALUE,
  DEFAULT_STATUS_FILTER,
  defaultEmployeeFilters,
  type EmployeeFilters,
} from "@/types/employee-filters"

/**
 * The URL is the single source of truth for every Advanced/Status/Search
 * filter on the Employees list — a plain useState here would reset the
 * instant the component unmounts (e.g. navigating to an Employee Profile
 * and back), which is exactly the bug this pair of functions exists to
 * fix. Each filter field gets its own query param, one-to-one; a value
 * equal to that field's own default (ALL_VALUE, DEFAULT_STATUS_FILTER, or
 * "") is never written to the URL, so a plain /employees visit stays a
 * plain /employees visit.
 */
const PARAM_KEYS: Record<keyof EmployeeFilters, string> = {
  search: "search",
  company: "company",
  workLocation: "workLocation",
  department: "department",
  position: "position",
  manager: "manager",
  employmentType: "employmentType",
  employmentStatus: "status",
  smartFilter: "smartFilter",
}

export function filtersToSearchParams(filters: EmployeeFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of Object.keys(PARAM_KEYS) as (keyof EmployeeFilters)[]) {
    const value = filters[key]
    if (value && value !== defaultEmployeeFilters[key]) {
      params.set(PARAM_KEYS[key], value)
    }
  }
  return params
}

/**
 * The inverse — hydrates filter state from whatever query string the page
 * loaded with (a fresh visit, a shared link, or the Employee Profile's
 * "Back to Employees" returning here). Every value is read as a plain
 * string and handed straight to the same filter predicates the Advanced
 * Filters panel already uses (employee-list-client.tsx's `filtered`) —
 * an unrecognized company/department/position/manager/employmentType
 * simply matches zero employees, the same as picking a stale option would,
 * never a crash. employmentStatus is the one field validated against a
 * known set, since DEFAULT_STATUS_FILTER/ALL_VALUE are meaningful
 * sentinels the status <Select> itself branches on.
 */
export function searchParamsToFilters(searchParams: URLSearchParams): EmployeeFilters {
  const status = searchParams.get(PARAM_KEYS.employmentStatus)
  return {
    search: searchParams.get(PARAM_KEYS.search) ?? defaultEmployeeFilters.search,
    company: searchParams.get(PARAM_KEYS.company) ?? defaultEmployeeFilters.company,
    workLocation: searchParams.get(PARAM_KEYS.workLocation) ?? defaultEmployeeFilters.workLocation,
    department: searchParams.get(PARAM_KEYS.department) ?? defaultEmployeeFilters.department,
    position: searchParams.get(PARAM_KEYS.position) ?? defaultEmployeeFilters.position,
    manager: searchParams.get(PARAM_KEYS.manager) ?? defaultEmployeeFilters.manager,
    employmentType: searchParams.get(PARAM_KEYS.employmentType) ?? defaultEmployeeFilters.employmentType,
    employmentStatus: status === ALL_VALUE || status === DEFAULT_STATUS_FILTER || isKnownStatus(status)
      ? (status as string)
      : defaultEmployeeFilters.employmentStatus,
    smartFilter: searchParams.get(PARAM_KEYS.smartFilter) ?? defaultEmployeeFilters.smartFilter,
  }
}

function isKnownStatus(value: string | null): boolean {
  return value === "active" || value === "probation" || value === "suspended" || value === "inactive" || value === "terminated"
}

/** The current list URL (pathname + this exact filter state), for any
 * caller that needs to link back here later — Employee Card/Table's link
 * to a profile page threads this through as `returnTo` (see
 * employee-list-client.tsx and profile-header.tsx). */
export function buildEmployeesReturnUrl(pathname: string, filters: EmployeeFilters): string {
  const query = filtersToSearchParams(filters).toString()
  return query ? `${pathname}?${query}` : pathname
}
