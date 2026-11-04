import * as XLSX from "xlsx"
import { getTranslations } from "next-intl/server"

import { getReportFieldDefinition } from "@/lib/reports/field-registry"
import type { ReportColumn, ReportRow } from "@/types/reports"

export interface BuiltReportExportFile {
  base64: string
  fileName: string
}

/**
 * Renders one cell for export the same way the preview table renders it on
 * screen — enum fields translated via their registry's enumNamespace/
 * enumKeyMap, everything else as plain text — so the exported file never
 * shows a raw internal value (e.g. "full-time") the UI itself never shows.
 */
async function resolveCellText(
  row: ReportRow,
  column: ReportColumn,
  enumTranslators: Map<string, (key: string) => string>
): Promise<string> {
  const value = row[column]
  if (value === null || value === undefined) return ""

  const definition = getReportFieldDefinition(column)
  if (definition?.type === "enum" && definition.enumNamespace) {
    const raw = String(value)
    if (!raw) return ""
    const messageKey = definition.enumKeyMap?.[raw] ?? raw
    const translate = enumTranslators.get(column)
    return translate ? translate(messageKey) : raw
  }

  return String(value)
}

export async function buildReportExportFile(
  rows: ReportRow[],
  columns: ReportColumn[],
  locale: string,
  reportName: string
): Promise<BuiltReportExportFile> {
  const tFields = await getTranslations({ locale, namespace: "Reports.fields" })

  const enumTranslators = new Map<string, (key: string) => string>()
  for (const column of columns) {
    const definition = getReportFieldDefinition(column)
    if (definition?.type === "enum" && definition.enumNamespace) {
      const t = await getTranslations({ locale, namespace: definition.enumNamespace })
      enumTranslators.set(column, t)
    }
  }

  const headerRow = columns.map((column) => {
    const definition = getReportFieldDefinition(column)
    return definition ? tFields(definition.labelKey) : column
  })

  const dataRows: string[][] = []
  for (const row of rows) {
    const cells = await Promise.all(columns.map((column) => resolveCellText(row, column, enumTranslators)))
    dataRows.push(cells)
  }

  const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report")
  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" })

  const datePart = new Date().toISOString().slice(0, 10)
  const safeName = reportName.trim().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-") || "report"
  const fileName = `${safeName}-${datePart}.xlsx`

  return { base64, fileName }
}
