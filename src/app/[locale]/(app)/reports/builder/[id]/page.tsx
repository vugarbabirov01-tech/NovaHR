import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { ReportBuilderClient } from "@/components/reports/report-builder-client"
import { findReportDefinitionById } from "@/repositories/report-definition-repository"

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Reports.builder" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("editTitle")} | ${common("appName")}` }
}

export default async function EditReportPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const report = await findReportDefinitionById(id)
  if (!report) notFound()

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <ReportBuilderClient
        locale={locale}
        initialReport={{
          id: report.id,
          name: report.name,
          description: report.description ?? "",
          columns: report.columns,
          filters: report.filters,
          sortBy: report.sortBy,
          sortDirection: report.sortDirection,
        }}
      />
    </div>
  )
}
