import * as XLSX from "xlsx"

import { getFullName } from "@/lib/employees"
import type { ImportRowResult } from "@/lib/employee-import/types"

/**
 * The official audit document for an import run — every processed row,
 * whether imported, updated, skipped, or blocked (§21). Built client-side
 * (the rows are already in the browser after the Import step finishes)
 * with the same library used to parse the source file. Errors and
 * warnings are split into their own columns (rather than one combined
 * "Messages" column) so the row-by-row status table reads the way §21's
 * own example does.
 */
export function downloadImportReport(results: ImportRowResult[], fileName: string) {
  const wasWritten = (row: ImportRowResult) => row.outcome === "imported" || row.outcome === "updated"

  const sheetRows = results.map((row) => ({
    Row: row.rowNumber,
    Employee: getFullName(row.mapped as { firstName: string; lastName: string }),
    FIN: row.mapped.finCode ?? "",
    Status: row.outcome,
    Errors: row.messages.filter((m) => m.severity === "error").map((m) => m.message).join(" | "),
    Warnings: row.messages.filter((m) => m.severity === "warning").map((m) => m.message).join(" | "),
    "Employee Number": wasWritten(row) ? (row.employeeNumber ?? "") : "",
    "Employee ID": wasWritten(row) ? (row.employeeId ?? "") : "",
  }))

  const worksheet = XLSX.utils.json_to_sheet(sheetRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Import Report")
  XLSX.writeFile(workbook, fileName)
}
