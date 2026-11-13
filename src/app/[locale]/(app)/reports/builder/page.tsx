import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { ReportBuilderClient } from "@/components/reports/report-builder-client"
import { findReportTemplate } from "@/lib/reports/report-templates"

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ template?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Reports.builder" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("newTitle")} | ${common("appName")}` }
}

export default async function NewReportPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { template: templateId } = await searchParams
  setRequestLocale(locale)

  // An unknown template id just opens an empty builder — never an error page.
  const template = templateId ? findReportTemplate(templateId) : undefined
  const tTemplates = await getTranslations({ locale, namespace: "Reports.templates" })

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <ReportBuilderClient
        locale={locale}
        prefill={
          template
            ? {
                name: tTemplates(`${template.id}.name`),
                description: tTemplates(`${template.id}.description`),
                dataSource: template.dataSource,
                columns: template.columns,
                filters: template.filters,
                sortBy: template.sortBy,
                sortDirection: template.sortDirection,
                kpis: template.kpis,
                chartConfig: template.chartConfig,
              }
            : undefined
        }
      />
    </div>
  )
}
