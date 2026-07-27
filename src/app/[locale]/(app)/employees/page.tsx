import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { EmployeeListClient } from "@/components/employees/employee-list-client"
import { employeeDirectory } from "@/data/employee-directory"
import { toListItem } from "@/types/employee-profile"
import { findActiveDepartments } from "@/repositories/department-repository"
import { findActivePositions } from "@/repositories/position-repository"
import { findActiveCompanies } from "@/repositories/company-repository"
import { findActiveBranches } from "@/repositories/branch-repository"
import { findActiveWorkSchedules } from "@/repositories/work-schedule-repository"
import { managerOptions } from "@/data/manager-directory"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Employees.list" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function EmployeesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Employees.list")
  const employees = employeeDirectory.map(toListItem)

  // The Add/Edit Employee wizard now opens as a drawer straight from this
  // page (Employee List, Employee Card), instead of navigating to a
  // dedicated route — so the master data it needs is fetched once here,
  // exactly like /employees/new used to, and handed down to the client.
  const [departments, positions, companies, branches, workSchedules] = await Promise.all([
    findActiveDepartments(),
    findActivePositions(),
    findActiveCompanies(),
    findActiveBranches(),
    findActiveWorkSchedules(),
  ])

  const masterData: WizardMasterData = {
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    positions: positions.map((p) => ({ id: p.id, title: p.title, departmentId: p.departmentId })),
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    branches: branches.map((b) => ({ id: b.id, name: b.name, companyId: b.companyId })),
    workSchedules: workSchedules.map((s) => ({ id: s.id, label: s.label })),
    managers: managerOptions.map((m) => ({ id: m.id, name: m.name })),
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />
      <EmployeeListClient employees={employees} masterData={masterData} />
    </div>
  )
}
