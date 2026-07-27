import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { WorkSchedulesPageClient } from "@/components/master-data/work-schedules-page-client"
import { findAllWorkSchedules } from "@/repositories/work-schedule-repository"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Pages.workSchedules" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function WorkSchedulesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Pages.workSchedules")
  const schedules = await findAllWorkSchedules()

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />
      <WorkSchedulesPageClient initialSchedules={schedules} />
    </div>
  )
}
