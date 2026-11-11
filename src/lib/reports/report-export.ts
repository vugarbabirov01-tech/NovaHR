import * as XLSX from "xlsx"
import { getFormatter, getTranslations } from "next-intl/server"

import { buildAnalyticsValueFormatters, buildDurationFormatter, formatAnalyticsValue, translateAnalyticsPointKey } from "@/lib/reports/analytics-format"
import { getReportFieldDefinition } from "@/lib/reports/field-registry"
import type { AnalyticsResult, ReportColumn, ReportRow } from "@/types/reports"

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
  enumTranslators: Map<string, (key: string) => string>,
  durationFormatter: (totalMonths: number) => string
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

  // Rendered the same way ReportPreviewTable renders it on screen — see
  // that field's own `displayUnit` comment in field-registry.ts.
  if (definition?.displayUnit === "durationMonths" && typeof value === "number") {
    return durationFormatter(value)
  }

  return String(value)
}

/** Human label for one AnalyticsSpec, shared by the KPI row's "total" and
 * the chart's own series, reused verbatim for the Summary export sheet so
 * the file's KPI rows read the same as the preview's own KPI cards. */
function analyticsSpecLabel(
  spec: AnalyticsResult["spec"],
  tAggregation: (key: string) => string,
  tFields: (key: string) => string,
  rowCountLabel: string
): string {
  if (spec.aggregation === "count" && !spec.groupBy) return rowCountLabel
  const fieldKey = spec.groupBy ? spec.groupBy.field : spec.valueField
  const fieldDef = fieldKey ? getReportFieldDefinition(fieldKey) : undefined
  const fieldLabel = fieldDef ? tFields(fieldDef.labelKey) : (fieldKey ?? "")
  if (spec.aggregation === "count") return fieldLabel // grouped count, e.g. "by department"
  return `${tAggregation(spec.aggregation)} — ${fieldLabel}`
}

export async function buildReportExportFile(
  rows: ReportRow[],
  columns: ReportColumn[],
  locale: string,
  reportName: string,
  kpis: AnalyticsResult[] = [],
  chart: AnalyticsResult | null = null
): Promise<BuiltReportExportFile> {
  const tFields = await getTranslations({ locale, namespace: "Reports.fields" })
  const tBuilder = await getTranslations({ locale, namespace: "Reports.builder" })
  const tAggregation = await getTranslations({ locale, namespace: "Reports.builder.aggregation" })
  const tEnumRoot = await getTranslations({ locale })
  const format = await getFormatter({ locale })
  const durationFormatter = buildDurationFormatter(tFields)
  const valueFormatters = buildAnalyticsValueFormatters(tFields, format.number)

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
    const cells = await Promise.all(columns.map((column) => resolveCellText(row, column, enumTranslators, durationFormatter)))
    dataRows.push(cells)
  }

  const workbook = XLSX.utils.book_new()
  // 2026-11-11: a report may now be KPI/chart-only (see
  // hasAtLeastOneOutput in lib/validation/reports.ts) — an empty
  // `columns` array means there is no detail sheet to write at all,
  // never a degenerate zero-column "Report" sheet.
  if (columns.length > 0) {
    const dataWorksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
    XLSX.utils.book_append_sheet(workbook, dataWorksheet, "Report")
  }

  // "Xülasə" sheet — the same KPI values and chart breakdown the live
  // preview shows, computed from the full filtered set (never just the
  // exported rows above, which may themselves be the full set or a page —
  // kpis/chart always come from report-execution-service.ts's own
  // pre-pagination computation regardless).
  if (kpis.length > 0 || chart) {
    const summaryRows: (string | number)[][] = []
    if (kpis.length > 0) {
      summaryRows.push([tBuilder("summaryKpiSectionTitle")])
      for (const kpi of kpis) {
        const label = analyticsSpecLabel(kpi.spec, tAggregation, tFields, tBuilder("rowCountLabel"))
        const value = formatAnalyticsValue(kpi.points[0]?.value ?? 0, kpi.spec, valueFormatters)
        summaryRows.push([label, value])
      }
    }
    if (chart) {
      if (summaryRows.length > 0) summaryRows.push([])
      summaryRows.push([tBuilder("summaryChartSectionTitle")])
      const chartValueLabel = analyticsSpecLabel(chart.spec, tAggregation, tFields, tBuilder("rowCountLabel"))
      summaryRows.push([tBuilder("summaryChartGroupColumn"), chartValueLabel, tBuilder("summaryChartPercentageColumn")])
      for (const point of chart.points) {
        const pointLabel = translateAnalyticsPointKey(point.key, chart.spec.groupBy, {
          translateMessagePath: tEnumRoot,
          otherLabel: tBuilder("chartOtherBucket"),
          formatDateTime: format.dateTime,
        })
        const percentageText = typeof point.percentage === "number" ? `${point.percentage}%` : ""
        summaryRows.push([pointLabel, formatAnalyticsValue(point.value, chart.spec, valueFormatters), percentageText])
      }
    }
    const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryRows)
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Summary")
  }

  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" })

  const datePart = new Date().toISOString().slice(0, 10)
  const safeName = reportName.trim().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-") || "report"
  const fileName = `${safeName}-${datePart}.xlsx`

  return { base64, fileName }
}
