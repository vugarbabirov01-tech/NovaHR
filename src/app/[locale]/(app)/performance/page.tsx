import type { Metadata } from "next"
import { TrendingUp } from "lucide-react"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PlaceholderPage } from "@/components/common/placeholder-page"


type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Pages.performance" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function PerformancePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Pages.performance")

  return (
    <PlaceholderPage title={t("title")} description={t("description")} icon={TrendingUp} />
  )
}
