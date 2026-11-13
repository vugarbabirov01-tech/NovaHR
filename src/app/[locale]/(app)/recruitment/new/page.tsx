import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { RequisitionForm } from "@/components/recruitment/requisition-form"
import { findActiveBranches } from "@/repositories/branch-repository"
import { findActiveDepartments } from "@/repositories/department-repository"

type Props = {
  params: Promise<{ locale: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Recruitment.form" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("createTitle")} | ${common("appName")}` }
}

export default async function NewVacancyPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Recruitment.form")
  const [departments, branches] = await Promise.all([findActiveDepartments(), findActiveBranches()])

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("createTitle")} />
      <RequisitionForm
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  )
}
