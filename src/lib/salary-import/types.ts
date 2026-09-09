/**
 * Salary Import is deliberately its own small module, not a mode of the
 * Employee Import wizard (src/lib/employee-import/) — it can never create,
 * delete, or otherwise touch an employee, only overwrite payroll.baseSalary
 * on a record matched by FIN. Where the same concept already exists (column
 * header detection, salary/date cell parsing, the xlsx read/write plumbing)
 * this module calls straight into employee-import's own exported helpers
 * instead of re-implementing them — see row-parser.ts and actions.ts.
 */

export type SalaryImportRowStatus =
  | "ready" // no salary on file yet — will be set for the first time
  | "will-update" // existing salary differs from the file's value
  | "no-change" // existing salary already matches the file's value
  | "not-found" // no employee with this FIN
  | "error" // invalid/missing salary, or a FIN duplicated within the file

export interface SalaryImportPreviewRow {
  rowNumber: number
  finCode: string
  /** Resolved employee full name — undefined when the FIN wasn't found. */
  employeeName?: string
  employeeId?: string
  /** Current payroll.baseSalary on file, undefined when there's none yet. */
  currentSalary?: number
  /** The parsed AZN amount from the file — undefined only when parsing failed (status "error"). */
  newSalary?: number
  effectiveDate?: string
  status: SalaryImportRowStatus
  /** Human-readable reason — always set for "error"/"not-found", the Azerbaijani business message shown as the Status cell. */
  message: string
}

export interface SalaryImportPreviewSummary {
  totalRows: number
  matched: number
  notFound: number
  errors: number
}

export interface SalaryImportPreviewResult {
  rows: SalaryImportPreviewRow[]
  summary: SalaryImportPreviewSummary
}

export interface SalaryImportCommitSummary {
  updated: number
  notFound: number
  errors: number
}

export interface SalaryImportCommitResult {
  summary: SalaryImportCommitSummary
  /** Every row that didn't end up written — not-found and error rows — for the "export failed rows" download. */
  failedRows: SalaryImportPreviewRow[]
}
