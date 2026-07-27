import * as XLSX from "xlsx"

import type { ImportRowResult } from "@/lib/employee-import/types"

/**
 * The official audit document for an import run — every processed row,
 * whether imported, skipped, or blocked. Built client-side (the rows are
 * already in the browser after the Import step finishes) with the same
 * library used to parse the source file.
 */
export function downloadImportReport(results: ImportRowResult[], fileName: string) {
  const sheetRows = results.map((row) => ({
    "Original Row Number": row.rowNumber,
    Status: row.outcome,
    Severity: row.severity,
    Messages: row.messages.map((m) => m.message).join(" | "),
    "Imported Employee Number": row.outcome === "imported" ? (row.employeeNumber ?? "") : "",
    "Imported Employee ID": row.outcome === "imported" ? (row.employeeId ?? "") : "",
  }))

  const worksheet = XLSX.utils.json_to_sheet(sheetRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Import Report")
  XLSX.writeFile(workbook, fileName)
}
