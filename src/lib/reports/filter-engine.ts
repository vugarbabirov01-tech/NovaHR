import { getReportFieldDefinition } from "@/lib/reports/field-registry"
import type { ReportFilter, ReportRow } from "@/types/reports"

function isEmptyValue(value: ReportRow[string]): boolean {
  return value === null || value === undefined || value === ""
}

function toComparable(value: ReportRow[string], type: "number" | "date"): number | null {
  if (isEmptyValue(value)) return null
  if (type === "number") {
    const n = typeof value === "number" ? value : Number(value)
    return Number.isNaN(n) ? null : n
  }
  const t = new Date(String(value)).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * Evaluates one filter against one flattened row. Returns true (row kept)
 * whenever the field isn't in the registry or the filter's value is
 * missing for an operator that requires one — fail open on malformed
 * input rather than silently hiding rows, since this only ever runs
 * server-side against a fixed, whitelisted field/operator set (never raw
 * SQL or user-supplied code).
 */
function matchesFilter(row: ReportRow, filter: ReportFilter): boolean {
  const definition = getReportFieldDefinition(filter.field)
  if (!definition) return true

  const rawValue = row[filter.field]

  if (filter.operator === "isEmpty") return isEmptyValue(rawValue)
  if (filter.operator === "isNotEmpty") return !isEmptyValue(rawValue)

  if (definition.type === "number" || definition.type === "date") {
    const rowComparable = toComparable(rawValue, definition.type)
    if (filter.operator === "between") {
      const lower = toComparable(filter.value ?? null, definition.type)
      const upper = toComparable(filter.valueTo ?? null, definition.type)
      if (rowComparable === null || lower === null || upper === null) return false
      return rowComparable >= lower && rowComparable <= upper
    }
    const target = toComparable(filter.value ?? null, definition.type)
    if (rowComparable === null || target === null) return false
    switch (filter.operator) {
      case "equals":
        return rowComparable === target
      case "notEquals":
        return rowComparable !== target
      case "greaterThan":
        return rowComparable > target
      case "lessThan":
        return rowComparable < target
      default:
        return true
    }
  }

  // string / enum — plain, case-insensitive text comparison. Enum values
  // are compared against their raw stored value (e.g. "full-time"), which
  // is exactly what the filter UI's option values are, not the translated
  // label.
  const rowText = String(rawValue ?? "").toLowerCase()
  const targetText = String(filter.value ?? "").toLowerCase()
  switch (filter.operator) {
    case "equals":
      return rowText === targetText
    case "notEquals":
      return rowText !== targetText
    case "contains":
      return rowText.includes(targetText)
    case "startsWith":
      return rowText.startsWith(targetText)
    default:
      return true
  }
}

/** Phase 1: every filter in the list is combined with AND. */
export function applyFilters(rows: ReportRow[], filters: ReportFilter[]): ReportRow[] {
  if (filters.length === 0) return rows
  return rows.filter((row) => filters.every((filter) => matchesFilter(row, filter)))
}

export function sortRows(rows: ReportRow[], sortBy: string | null, direction: "asc" | "desc"): ReportRow[] {
  if (!sortBy) return rows
  const definition = getReportFieldDefinition(sortBy)
  const sorted = [...rows].sort((a, b) => {
    const aValue = a[sortBy]
    const bValue = b[sortBy]
    let comparison: number
    if (definition?.type === "number" || definition?.type === "date") {
      const aComparable = toComparable(aValue, definition.type) ?? -Infinity
      const bComparable = toComparable(bValue, definition.type) ?? -Infinity
      comparison = aComparable - bComparable
    } else {
      comparison = String(aValue ?? "").localeCompare(String(bValue ?? ""))
    }
    return direction === "asc" ? comparison : -comparison
  })
  return sorted
}
