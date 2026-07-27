import * as XLSX from "xlsx"

import { IMPORTABLE_FIELD_ORDER, getFieldHeaderLabel } from "@/lib/employee-import/column-mapping"
import { REPORT_ONLY_FIELD_LABELS, REPORT_ONLY_FIELD_ORDER } from "@/lib/employee-export/report-only-fields"
import type { ExportRow } from "@/lib/employee-export/profile-to-export-row"
import type { ExportFormat, ExportType } from "@/lib/employee-export/types"

interface ExportColumn {
  key: string
  header: string
}

/**
 * Import Template = exactly IMPORTABLE_FIELD_ORDER, in that order, with
 * each column's header taken from the same registry Import's own
 * suggestFieldForColumn reads — the two can never drift apart. Full Report
 * appends the reporting-only columns after the template, so the first N
 * columns are still identical between both export types.
 */
function getExportColumns(exportType: ExportType): ExportColumn[] {
  const templateColumns = IMPORTABLE_FIELD_ORDER.map((field) => ({
    key: field,
    header: getFieldHeaderLabel(field),
  }))

  if (exportType === "importTemplate") return templateColumns

  const reportColumns = REPORT_ONLY_FIELD_ORDER.map((field) => ({
    key: field,
    header: REPORT_ONLY_FIELD_LABELS[field],
  }))

  return [...templateColumns, ...reportColumns]
}

export interface BuiltExportFile {
  base64: string
  fileName: string
}

export function buildExportFile(
  rows: ExportRow[],
  format: ExportFormat,
  exportType: ExportType
): BuiltExportFile {
  const columns = getExportColumns(exportType)

  // Build with plain arrays (aoa) instead of json_to_sheet so column order
  // and headers are exactly `columns`, never inferred from object key
  // order — and blank values stay genuinely blank cells, never the string
  // "undefined" (requirement: empty cells must be blank).
  const headerRow = columns.map((c) => c.header)
  const dataRows = rows.map((row) => columns.map((c) => (row as Record<string, string>)[c.key] ?? ""))

  const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
  const workbook = XLSX.utils.book_new()
  const sheetName = exportType === "importTemplate" ? "Employees" : "Full Report"
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const bookType = format === "xlsx" ? "xlsx" : "csv"
  const base64 = XLSX.write(workbook, { type: "base64", bookType })

  const datePart = new Date().toISOString().slice(0, 10)
  const typePart = exportType === "importTemplate" ? "import-template" : "full-report"
  const fileName = `employees-${typePart}-${datePart}.${format}`

  return { base64, fileName }
}
