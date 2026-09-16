import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Banknote, PlusCircle, Users, Wallet } from "lucide-react"

import { PageTitle } from "@/components/common/page-title"
import { KpiCard } from "@/components/common/kpi-card"
import { PayrollPeriodSwitcher } from "@/components/payroll/payroll-period-switcher"
import { PayrollClient } from "@/components/payroll/payroll-client"
import { ensurePayrollPeriod } from "@/lib/payroll/payroll-period-service"
import { findAllEmployees } from "@/repositories/employee-repository"
import { getFullLegalName } from "@/lib/employees"
import { formatAzn } from "@/lib/salary-import/apply-salary-update"
import type { PayrollEmployeeRow, PayrollPeriodStatus } from "@/types/payroll"

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}

// Payroll figures change with every visit while a period is still open
// (later phases will let additions/deductions be edited) — never freeze
// this into the build the way most of this app's Prisma-backed pages do.
export const dynamic = "force-dynamic"

function currentPeriod(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function parsePeriod(searchParams: { year?: string; month?: string }): { year: number; month: number } {
  const fallback = currentPeriod()
  const year = Number(searchParams.year)
  const month = Number(searchParams.month)
  const validYear = Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : fallback.year
  const validMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : fallback.month
  return { year: validYear, month: validMonth }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

function formatRangeLabel(startDate: Date, endDate: Date): string {
  const start = `${pad2(startDate.getUTCDate())}.${pad2(startDate.getUTCMonth() + 1)}.${startDate.getUTCFullYear()}`
  const end = `${pad2(endDate.getUTCDate())}.${pad2(endDate.getUTCMonth() + 1)}.${endDate.getUTCFullYear()}`
  return `${start} – ${end}`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Pages.payroll" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function PayrollPage({ params, searchParams }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const { year, month } = parsePeriod(await searchParams)

  const t = await getTranslations("Pages.payroll")
  const tPayroll = await getTranslations("Payroll")

  const [{ period, records }, employees] = await Promise.all([
    ensurePayrollPeriod(year, month),
    findAllEmployees(),
  ])

  const employeesById = new Map(employees.map((employee) => [employee.id, employee]))

  const rows: PayrollEmployeeRow[] = records
    .map((record): PayrollEmployeeRow | null => {
      const employee = employeesById.get(record.employeeId)
      if (!employee) return null
      return {
        id: record.id,
        employeeId: employee.id,
        fullName: getFullLegalName(employee.personal),
        firstName: employee.personal.firstName,
        lastName: employee.personal.lastName,
        finCode: employee.personal.finCode,
        company: employee.employment.company,
        workLocation: employee.employment.workLocation,
        position: employee.employment.position,
        photoUrl: employee.personal.photoUrl,
        baseSalary: record.baseSalary,
        currency: record.currency,
        additions: record.additions,
        deductions: record.deductions,
        grossAmount: record.grossAmount,
        netAmount: record.netAmount,
        status: record.status as PayrollPeriodStatus,
      }
    })
    .filter((row): row is PayrollEmployeeRow => row !== null)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))

  const totalBaseSalary = rows.reduce((sum, row) => sum + row.baseSalary, 0)
  const totalAdditions = rows.reduce((sum, row) => sum + row.additions, 0)
  const totalNet = rows.reduce((sum, row) => sum + row.netAmount, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />

      <PayrollPeriodSwitcher
        year={period.year}
        month={period.month}
        rangeLabel={formatRangeLabel(period.startDate, period.endDate)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={tPayroll("kpiEmployeeCount")} value={String(rows.length)} icon={Users} />
        <KpiCard label={tPayroll("kpiTotalBaseSalary")} value={formatAzn(totalBaseSalary)} icon={Wallet} />
        <KpiCard label={tPayroll("kpiTotalAdditions")} value={formatAzn(totalAdditions)} icon={PlusCircle} />
        <KpiCard label={tPayroll("kpiTotalNet")} value={formatAzn(totalNet)} icon={Banknote} />
      </div>

      <PayrollClient rows={rows} />
    </div>
  )
}
