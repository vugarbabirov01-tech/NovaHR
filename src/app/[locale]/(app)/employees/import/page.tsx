import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { EmployeeImportWizard } from "@/components/employees/import/employee-import-wizard"
import { getWizardMasterData } from "@/lib/wizard-master-data"
import { listImportDrafts } from "@/data/import-draft-store"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Employees.import" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function EmployeeImportPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Employees.import")
  const [masterData, drafts] = await Promise.all([getWizardMasterData(), Promise.resolve(listImportDrafts())])

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />
      <EmployeeImportWizard masterData={masterData} initialDrafts={drafts} />
    </div>
  )
}
