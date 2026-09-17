import { findAllEmployees } from "@/repositories/employee-repository"
import { findActiveCompanies } from "@/repositories/company-repository"
import { findActiveBranches } from "@/repositories/branch-repository"
import { findActiveDepartments } from "@/repositories/department-repository"
import { findActivePositions } from "@/repositories/position-repository"
import { getFullLegalName } from "@/lib/employees"
import { normalizeSearchText, tokenize } from "@/lib/global-search/normalize"
import type { EmployeeProfile } from "@/types/employee-profile"
import type {
  GlobalSearchCategoryResult,
  GlobalSearchResponse,
  GlobalSearchResultItem,
} from "@/types/global-search"

const MAX_RESULTS_PER_CATEGORY = 5

/** Every token from tokenize() must appear somewhere in the normalized
 * haystack — order-independent AND matching, not one contiguous substring.
 * The one place every category's matching rule is defined; a future
 * server-side/DB search replaces this function's body, never its callers. */
function matches(haystack: string, tokens: string[]): boolean {
  const normalized = normalizeSearchText(haystack)
  return tokens.every((token) => normalized.includes(token))
}

function searchEmployees(employees: EmployeeProfile[], tokens: string[]): GlobalSearchResultItem[] {
  return employees
    .filter((employee) => employee.employmentStatus === "active")
    .filter((employee) => {
      const haystack = [
        employee.personal.firstName,
        employee.personal.lastName,
        employee.personal.fatherName,
        employee.personal.finCode,
        employee.employment.employeeNumber,
        employee.personal.phone,
        employee.personal.email,
        employee.employment.position,
        employee.employment.department,
        employee.employment.company,
        employee.employment.branch,
        employee.employment.workLocation,
      ]
        .filter(Boolean)
        .join(" ")
      return matches(haystack, tokens)
    })
    .map((employee) => ({
      id: employee.id,
      category: "employees" as const,
      title: getFullLegalName(employee.personal),
      subtitle: [employee.employment.position, employee.employment.workLocation].filter(Boolean).join(" · "),
      href: `/employees/${employee.id}`,
    }))
}

function searchWorkLocations(employees: EmployeeProfile[], tokens: string[]): GlobalSearchResultItem[] {
  const values = new Set(
    employees
      .filter((employee) => employee.employmentStatus === "active")
      .map((employee) => employee.employment.workLocation)
      .filter(Boolean)
  )
  return Array.from(values)
    .filter((value) => matches(value, tokens))
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({
      id: value,
      category: "workLocations" as const,
      title: value,
      href: `/employees?workLocation=${encodeURIComponent(value)}`,
    }))
}

function searchCompanies(
  companies: { id: string; name: string; code: string }[],
  tokens: string[]
): GlobalSearchResultItem[] {
  return companies
    .filter((company) => matches(`${company.name} ${company.code}`, tokens))
    .map((company) => ({
      id: company.id,
      category: "companies" as const,
      title: company.name,
      subtitle: company.code,
      href: "/companies",
    }))
}

function searchBranches(
  branches: { id: string; name: string; code: string }[],
  tokens: string[]
): GlobalSearchResultItem[] {
  return branches
    .filter((branch) => matches(`${branch.name} ${branch.code}`, tokens))
    .map((branch) => ({
      id: branch.id,
      category: "branches" as const,
      title: branch.name,
      subtitle: branch.code,
      href: "/branches",
    }))
}

function searchDepartments(
  departments: { id: string; name: string; code: string }[],
  tokens: string[]
): GlobalSearchResultItem[] {
  return departments
    .filter((department) => matches(`${department.name} ${department.code}`, tokens))
    .map((department) => ({
      id: department.id,
      category: "departments" as const,
      title: department.name,
      subtitle: department.code,
      href: "/departments",
    }))
}

function searchPositions(
  positions: { id: string; title: string; code: string }[],
  tokens: string[]
): GlobalSearchResultItem[] {
  return positions
    .filter((position) => matches(`${position.title} ${position.code}`, tokens))
    .map((position) => ({
      id: position.id,
      category: "positions" as const,
      title: position.title,
      subtitle: position.code,
      href: "/positions",
    }))
}

function toCategoryResult(
  category: GlobalSearchCategoryResult["category"],
  items: GlobalSearchResultItem[],
  showAllHref?: string
): GlobalSearchCategoryResult | null {
  if (items.length === 0) return null
  return {
    category,
    totalCount: items.length,
    items: items.slice(0, MAX_RESULTS_PER_CATEGORY),
    showAllHref: items.length > MAX_RESULTS_PER_CATEGORY ? showAllHref : undefined,
  }
}

/**
 * The one seam a future server-side/DB-backed search replaces — every
 * caller (globalSearchAction) only ever sees this function's return shape,
 * never how a match is actually found. Today it fetches through the same
 * repositories Employees/Companies/Branches/Departments/Positions already
 * call (no parallel data store) and filters in memory, exactly like every
 * one of those pages already does with its own full table.
 */
export async function runGlobalSearch(query: string): Promise<GlobalSearchResponse> {
  const tokens = tokenize(query)
  if (tokens.length === 0) return { query, categories: [] }

  const [employees, companies, branches, departments, positions] = await Promise.all([
    findAllEmployees(),
    findActiveCompanies(),
    findActiveBranches(),
    findActiveDepartments(),
    findActivePositions(),
  ])

  const categories = [
    toCategoryResult("employees", searchEmployees(employees, tokens), `/employees?search=${encodeURIComponent(query)}`),
    toCategoryResult("companies", searchCompanies(companies, tokens), "/companies"),
    toCategoryResult("branches", searchBranches(branches, tokens), "/branches"),
    toCategoryResult("departments", searchDepartments(departments, tokens), "/departments"),
    toCategoryResult("positions", searchPositions(positions, tokens), "/positions"),
    // No "show all" — there's no page listing every distinct work location.
    toCategoryResult("workLocations", searchWorkLocations(employees, tokens)),
  ].filter((result): result is GlobalSearchCategoryResult => result !== null)

  return { query, categories }
}
