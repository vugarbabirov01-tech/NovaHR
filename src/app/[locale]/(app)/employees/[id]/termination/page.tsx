import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { TerminationPageContent } from "@/components/employees/termination/termination-page-content"
import { findEmployeeById } from "@/repositories/employee-repository"

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Employees.termination" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("wizardTitle")} | ${common("appName")}` }
}

export default async function EmployeeTerminationPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const profile = await findEmployeeById(id)
  if (!profile) notFound()

  const t = await getTranslations("Employees.termination")

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("wizardTitle")} description={t("wizardDescription")} />
      <TerminationPageContent employeeId={id} profile={profile} />
    </div>
  )
}
