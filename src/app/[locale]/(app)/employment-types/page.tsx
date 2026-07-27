import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { EmploymentTypesPageClient } from "@/components/master-data/employment-types-page-client"
import { findAllEmploymentTypes } from "@/repositories/employment-type-repository"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Pages.employmentTypes" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function EmploymentTypesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Pages.employmentTypes")
  const employmentTypes = await findAllEmploymentTypes()

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />
      <EmploymentTypesPageClient initialEmploymentTypes={employmentTypes} />
    </div>
  )
}
