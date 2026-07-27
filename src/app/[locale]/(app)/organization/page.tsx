import type { Metadata } from "next"
import { Network } from "lucide-react"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PlaceholderPage } from "@/components/common/placeholder-page"


type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Pages.organization" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function OrganizationPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Pages.organization")

  return (
    <PlaceholderPage title={t("title")} description={t("description")} icon={Network} />
  )
}
