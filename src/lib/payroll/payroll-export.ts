import { getTranslations } from "next-intl/server"
import * as XLSX from "xlsx"

import type { PayrollEmployeeRow } from "@/types/payroll"

export interface BuiltPayrollExportFile {
  base64: string
  fileName: string
}

/**
 * One sheet, one row per employee, money as real numbers (so Excel can sum
 * and format them) plus a bold-less totals row at the bottom. Mirrors the
 * on-screen table, with the columns the screen keeps in the sub-line
 * (FİN, company, work location, position) spelled out.
 */
export async function buildPayrollExportFile(
  rows: PayrollEmployeeRow[],
  year: number,
  month: number,
  locale: string
): Promise<BuiltPayrollExportFile> {
  const t = await getTranslations({ locale, namespace: "Payroll" })
  const tStatus = await getTranslations({ locale, namespace: "Payroll.status" })

  const header = [
    t("columnEmployee"),
    t("columnFin"),
    t("columnCompany"),
    t("columnWorkLocation"),
    t("columnPosition"),
    t("columnGross"),
    t("columnNet"),
    t("columnAdditions"),
    t("columnDeductions"),
    t("columnPayable"),
    t("columnStatus"),
  ]

  const body: (string | number | null)[][] = rows.map((row) => [
    row.fullName,
    row.finCode,
    row.company,
    row.workLocation,
    row.position,
    row.grossSalary ?? null,
    row.baseSalary,
    row.additions,
    row.deductions,
    row.netAmount,
    tStatus(row.status),
  ])

  const sum = (pick: (row: PayrollEmployeeRow) => number) => rows.reduce((total, row) => total + pick(row), 0)
  body.push([
    t("footerTotal", { count: rows.length }),
    "",
    "",
    "",
    "",
    sum((r) => r.grossSalary ?? 0),
    sum((r) => r.baseSalary),
    sum((r) => r.additions),
    sum((r) => r.deductions),
    sum((r) => r.netAmount),
    "",
  ])

  const sheet = XLSX.utils.aoa_to_sheet([header, ...body])
  sheet["!cols"] = [{ wch: 34 }, { wch: 10 }, { wch: 26 }, { wch: 26 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }]
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, `${year}-${String(month).padStart(2, "0")}`)
  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" }) as string
  return { base64, fileName: `payroll-${year}-${String(month).padStart(2, "0")}.xlsx` }
}
