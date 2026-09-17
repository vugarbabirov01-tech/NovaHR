export type GlobalSearchCategory =
  | "employees"
  | "companies"
  | "branches"
  | "departments"
  | "positions"
  | "workLocations"

export interface GlobalSearchResultItem {
  id: string
  category: GlobalSearchCategory
  /** e.g. getFullLegalName(...) for an employee, or a Company's name. */
  title: string
  /** e.g. "position · workLocation" for an employee, or a code. */
  subtitle?: string
  /** Locale-relative — "/employees/EMP-001", "/companies", ... — always
   * navigated through Link/useRouter from @/i18n/navigation so the
   * current locale prefix is preserved automatically. */
  href: string
}

export interface GlobalSearchCategoryResult {
  category: GlobalSearchCategory
  /** The real match count, before the per-category cap. */
  totalCount: number
  /** Capped at MAX_RESULTS_PER_CATEGORY (global-search-service.ts). */
  items: GlobalSearchResultItem[]
  /** Only set when totalCount exceeds items.length AND there's somewhere
   * useful to send "show all" — omitted for workLocations, which has no
   * list-of-all-locations page to link to. */
  showAllHref?: string
}

export interface GlobalSearchResponse {
  query: string
  /** Only categories with at least one match — an empty category is never
   * rendered as a zero-result section. */
  categories: GlobalSearchCategoryResult[]
}
