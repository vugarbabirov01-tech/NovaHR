import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { PositionsPageClient } from "@/components/master-data/positions-page-client"
import { findAllPositions } from "@/repositories/position-repository"
import { findActiveDepartments } from "@/repositories/department-repository"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Pages.positions" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function PositionsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Pages.positions")
  const [positions, departments] = await Promise.all([findAllPositions(), findActiveDepartments()])

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />
      <PositionsPageClient initialPositions={positions} departments={departments} />
    </div>
  )
}
