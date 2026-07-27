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

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />

      <KpiSection />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <HeadcountTrendChart />
        </div>
        <DepartmentChart />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentEmployees />
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
