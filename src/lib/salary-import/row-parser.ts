import { suggestFieldForColumn } from "@/lib/employee-import/column-mapping"
import { parseImportDate, parseSalaryAmount } from "@/lib/employee-import/row-mapper"
import { ImportValidationMessages } from "@/lib/employee-import/validation-messages"
import type { RawImportRow } from "@/lib/employee-import/types"

/** One row after the raw Excel cells have been parsed, but before any
 * database lookup — everything here runs in the browser (no `finCode`
 * value is trusted or normalized any further than trim+uppercase, the
 * exact same normalization findEmployeeByFin already applies server-side). */
export interface ParsedSalaryRow {
  rowNumber: number
  finCode: string
  salary?: number
  effectiveDate?: string
  /** Set when the salary cell was non-empty but unparseable, or FIN was blank — this row can never be imported regardless of what the FIN lookup finds. */
  parseError?: string
}

/** Finds which raw columns are FIN / salary / effective date, reusing the
 * exact same header vocabulary (canonical + alias) Employee Import already
 * recognizes — "FIN"/"FİN", "Maaş"/"Əmək haqqı", "Maaşın başlanma
 * tarixi"/"Qüvvəyə minmə tarixi" all resolve to the same three columns. */
export function detectSalaryColumns(headerColumns: string[]): {
  finColumn?: string
  salaryColumn?: string
  effectiveDateColumn?: string
} {
  let finColumn: string | undefined
  let salaryColumn: string | undefined
  let effectiveDateColumn: string | undefined

  for (const header of headerColumns) {
    const field = suggestFieldForColumn(header)
    if (field === "finCode" && !finColumn) finColumn = header
    else if (field === "salary" && !salaryColumn) salaryColumn = header
    else if (field === "salaryStartDate" && !effectiveDateColumn) effectiveDateColumn = header
  }

  return { finColumn, salaryColumn, effectiveDateColumn }
}

export function parseSalaryRows(
  rawRows: RawImportRow[],
  columns: { finColumn?: string; salaryColumn?: string; effectiveDateColumn?: string }
): ParsedSalaryRow[] {
  return rawRows.map((row) => {
    const finRaw = columns.finColumn ? String(row.cells[columns.finColumn] ?? "").trim() : ""
    const salaryRaw = columns.salaryColumn ? String(row.cells[columns.salaryColumn] ?? "").trim() : ""
    const dateRaw = columns.effectiveDateColumn
      ? String(row.cells[columns.effectiveDateColumn] ?? "").trim()
      : ""

    const finCode = finRaw.toUpperCase()

    if (!finCode) {
      return { rowNumber: row.rowNumber, finCode: "", parseError: "FIN kodu göstərilməyib." }
    }

    if (!salaryRaw) {
      return { rowNumber: row.rowNumber, finCode, parseError: ImportValidationMessages.salaryMissing() }
    }

    const salary = parseSalaryAmount(salaryRaw)
    if (salary === null || salary <= 0) {
      return {
        rowNumber: row.rowNumber,
        finCode,
        parseError: ImportValidationMessages.salaryInvalid(salaryRaw),
      }
    }

    const effectiveDate = dateRaw ? (parseImportDate(dateRaw) ?? undefined) : undefined
    if (dateRaw && !effectiveDate) {
      return {
        rowNumber: row.rowNumber,
        finCode,
        salary,
        parseError: `Qüvvəyə minmə tarixi "${dateRaw}" düzgün formatda deyil.`,
      }
    }

    return { rowNumber: row.rowNumber, finCode, salary, effectiveDate }
  })
}

/** FINs appearing on more than one row — every row sharing one of these is blocked, not just the second occurrence (§5 — "detect and don't import"). */
export function findDuplicateFinCodes(rows: ParsedSalaryRow[]): Set<string> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.finCode) continue
    counts.set(row.finCode, (counts.get(row.finCode) ?? 0) + 1)
  }
  return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([fin]) => fin))
}
