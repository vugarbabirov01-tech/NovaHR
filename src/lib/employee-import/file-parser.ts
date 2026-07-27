import * as XLSX from "xlsx"

import type { RawImportRow } from "@/lib/employee-import/types"

export interface ParsedWorkbook {
  workbook: XLSX.WorkBook
  sheetNames: string[]
}

/**
 * Both .xlsx and .csv go through the same SheetJS entry point — a CSV file
 * just produces a workbook with a single implicit sheet — so every step
 * after this one (worksheet selection, mapping, validation) treats both
 * formats identically.
 */
export function parseWorkbook(fileName: string, data: ArrayBuffer | string): ParsedWorkbook {
  const isCsv = fileName.toLowerCase().endsWith(".csv")
  // CSV cells are plain text with no format info — SheetJS otherwise
  // guesses number/date types from the text itself (e.g. "1990-01-01"
  // becomes an Excel date serial), which parseImportDate then can't read
  // back. `raw: true` keeps every CSV cell as the literal source string.
  const workbook = isCsv
    ? XLSX.read(data as string, { type: "string", raw: true })
    : XLSX.read(data as ArrayBuffer, { type: "array", cellDates: true })

  return { workbook, sheetNames: workbook.SheetNames }
}

export interface ExtractedSheet {
  headerColumns: string[]
  rows: RawImportRow[]
}

export function extractSheetRows(workbook: XLSX.WorkBook, sheetName: string): ExtractedSheet {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return { headerColumns: [], rows: [] }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true })
  if (matrix.length === 0) return { headerColumns: [], rows: [] }

  const headerColumns = matrix[0].map((cell) => String(cell).trim()).filter((header) => header.length > 0)

  const rows: RawImportRow[] = matrix.slice(1).map((line, index) => {
    const cells: Record<string, unknown> = {}
    headerColumns.forEach((header, columnIndex) => {
      cells[header] = line[columnIndex] ?? ""
    })
    return { rowNumber: index + 2, cells } // +2: 1-indexed, plus the header row itself
  })

  // Drop fully-empty trailing rows (common at the end of exported sheets).
  const nonEmptyRows = rows.filter((row) => Object.values(row.cells).some((value) => String(value).trim() !== ""))

  return { headerColumns, rows: nonEmptyRows }
}
