import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { OrgChartClient } from "@/components/organization/org-chart-client"
import { findAllEmployees } from "@/repositories/employee-repository"
import { toListItem } from "@/types/employee-profile"
import { buildOrganizationTree } from "@/lib/organization/build-tree"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Pages.organization" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

/**
 * The Organization Chart — real employeeDirectory data (same source the
 * Employee List/Dashboard/Leave modules already read from) turned into a
 * tree via buildOrganizationTree, never a hand-authored hierarchy. The tree
 * (with every node's recursive descendant count already computed) is built
 * once here, server-side, and handed to the client for interactive
 * expand/collapse/search/filter/Full-Chart — matching the same Server
 * Component "fetch+compute" / Client Component "render+interact" split
 * every other Employees/Leave page already uses.
 */
export default async function OrganizationPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Pages.organization")

  const employees = (await findAllEmployees()).map(toListItem)
  const tree = buildOrganizationTree(employees)
  const managerNames = Array.from(
    new Set(employees.map((employee) => employee.managerName).filter((name): name is string => Boolean(name)))
  ).sort()

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />
      <OrgChartClient tree={tree} employees={employees} managerNames={managerNames} />
    </div>
  )
}
