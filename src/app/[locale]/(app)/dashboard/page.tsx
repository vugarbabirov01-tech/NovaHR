import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { KpiSection } from "@/components/dashboard/kpi-section"
import { HeadcountTrendChart } from "@/components/dashboard/headcount-trend-chart"
import { DepartmentChart } from "@/components/dashboard/department-chart"
import { RecentEmployees } from "@/components/dashboard/recent-employees"
import { UpcomingBirthdays } from "@/components/dashboard/upcoming-birthdays"
import { RecentActivities } from "@/components/dashboard/recent-activities"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { findAllEmployees } from "@/repositories/employee-repository"
import { toListItem } from "@/types/employee-profile"
import { resolveWorkStatus, type WorkStatus } from "@/lib/employee-work-status"
import { loadWorkStatusContext } from "@/lib/employee-work-status-loader"
import { getDepartmentHeadcounts, getHeadcountTrend } from "@/lib/dashboard-service"


type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Dashboard" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Dashboard")

  // Real Employee table data, most recently hired first — replaces the
  // old disconnected mock array (src/data/employees.ts) this widget used to
  // read from, which could never agree with the rest of the app.
  const employees = await findAllEmployees()
  const recentEmployees = [...employees]
    .sort((a, b) => new Date(b.employment.hireDate).getTime() - new Date(a.employment.hireDate).getTime())
    .slice(0, 5)
    .map(toListItem)
  const workStatusContext = await loadWorkStatusContext()
  const recentEmployeesWorkStatus: Record<string, WorkStatus> = {}
  for (const employee of recentEmployees) {
    recentEmployeesWorkStatus[employee.id] = resolveWorkStatus(employee.id, workStatusContext)
  }

  const [departmentHeadcounts, headcountTrend] = await Promise.all([
    getDepartmentHeadcounts(),
    getHeadcountTrend(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />

      <KpiSection />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <HeadcountTrendChart data={headcountTrend} />
        </div>
        <DepartmentChart data={departmentHeadcounts} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentEmployees employees={recentEmployees} workStatusByEmployeeId={recentEmployeesWorkStatus} />
        </div>
        <UpcomingBirthdays />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentActivities />
        </div>
        <QuickActions />
      </div>
    </div>
  )
}
