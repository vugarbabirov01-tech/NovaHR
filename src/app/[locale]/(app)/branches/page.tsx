import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { BranchesPageClient } from "@/components/master-data/branches-page-client"
import { findAllBranches } from "@/repositories/branch-repository"
import { findActiveCompanies } from "@/repositories/company-repository"
import { findAllEmployees } from "@/repositories/employee-repository"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Pages.branches" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function BranchesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Pages.branches")
  const [branches, companies, employees] = await Promise.all([
    findAllBranches(),
    findActiveCompanies(),
    findAllEmployees(),
  ])

  // Real counts, computed fresh on every page load from the live roster —
  // never cached on the Branch record itself, so it can never drift from
  // what employment.branchId actually says.
  const employeeCountByBranchId: Record<string, number> = {}
  for (const employee of employees) {
    const branchId = employee.employment.branchId
    if (!branchId) continue
    employeeCountByBranchId[branchId] = (employeeCountByBranchId[branchId] ?? 0) + 1
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />
      <BranchesPageClient
        initialBranches={branches}
        companies={companies}
        employeeCountByBranchId={employeeCountByBranchId}
      />
    </div>
  )
}
