import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { ReportBuilderClient } from "@/components/reports/report-builder-client"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Reports.builder" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("newTitle")} | ${common("appName")}` }
}

export default async function NewReportPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <ReportBuilderClient locale={locale} />
    </div>
  )
}
