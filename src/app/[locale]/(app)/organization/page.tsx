import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { OrganizationView } from "@/components/organization/organization-view"
import { findAllEmployees } from "@/repositories/employee-repository"
import { findActiveCompanies } from "@/repositories/company-repository"
import { findAllBranches } from "@/repositories/branch-repository"
import { toListItem } from "@/types/employee-profile"
import { buildOrganizationTree } from "@/lib/organization/build-tree"
import { toBranchesById } from "@/lib/employees"

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

  const [employeeProfiles, companyRows, allBranchRows] = await Promise.all([
    findAllEmployees(),
    findActiveCompanies(),
    findAllBranches(),
  ])
  // Resolution (an employee's branchId -> current display name) uses every
  // branch, active or archived — an employee doesn't lose their recorded
  // workplace just because Administration later archived that Branch
  // record. The Branch FILTER's own options stay active-only below, same as
  // Company's.
  const branchesById = toBranchesById(allBranchRows)
  const employees = employeeProfiles.map((profile) => toListItem(profile, branchesById))
  const tree = buildOrganizationTree(employees)
  const managerNames = Array.from(
    new Set(employees.map((employee) => employee.managerName).filter((name): name is string => Boolean(name)))
  ).sort()
  const companies = companyRows.map((company) => ({ id: company.id, name: company.name }))
  const branches = allBranchRows
    .filter((branch) => branch.active)
    .map((branch) => ({ id: branch.id, name: branch.name, companyId: branch.companyId }))

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />
      <OrganizationView
        tree={tree}
        employees={employees}
        managerNames={managerNames}
        companies={companies}
        branches={branches}
      />
    </div>
  )
}
