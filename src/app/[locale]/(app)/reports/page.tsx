import type { Metadata } from "next"
import { Plus } from "lucide-react"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { PageTitle } from "@/components/common/page-title"
import { buttonVariants } from "@/components/ui/button"
import { MyReportsList } from "@/components/reports/my-reports-list"
import { findAllReportDefinitions } from "@/repositories/report-definition-repository"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Pages.reports" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function ReportsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Reports.overview")
  const reports = await findAllReportDefinitions()

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title={t("title")}
        description={t("description")}
        actions={
          <Link href="/reports/builder" className={buttonVariants()}>
            <Plus className="size-4" strokeWidth={1.75} />
            {t("newReportButton")}
          </Link>
        }
      />
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">{t("myReportsTitle")}</h2>
        <MyReportsList reports={reports} />
      </div>
    </div>
  )
}
