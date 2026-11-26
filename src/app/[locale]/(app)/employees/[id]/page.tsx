import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { ProfileView } from "@/components/employees/profile/profile-view"
import { findAllEmployees, findEmployeeById } from "@/repositories/employee-repository"
import { findAllBranches } from "@/repositories/branch-repository"
import { getFullName, toBranchesById } from "@/lib/employees"
import { resolveWorkStatus } from "@/lib/employee-work-status"
import { loadWorkStatusContext } from "@/lib/employee-work-status-loader"
import { buildManagerChain } from "@/lib/organization/build-tree"
import { activePenalty } from "@/lib/discipline/discipline-rules"
import { listDisciplinaryActions } from "@/lib/discipline/discipline-service"
import { summarizeEntitlement } from "@/lib/leave/entitlement-summary"
import { resolveAnnualLeaveEntitlement } from "@/lib/leave/leave-policy-resolution-service"
import { toListItem } from "@/types/employee-profile"

type Props = {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ returnTo?: string }>
}

export async function generateStaticParams() {
  const employees = await findAllEmployees()
  return employees.map((employee) => ({ id: employee.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params
  const employee = await findEmployeeById(id)
  const common = await getTranslations({ locale, namespace: "Common" })

  if (!employee) return { title: common("appName") }

  return { title: `${getFullName(employee.personal)} | ${common("appName")}` }
}

export default async function EmployeeProfilePage({ params, searchParams }: Props) {
  const { locale, id } = await params
  const { returnTo } = await searchParams
  setRequestLocale(locale)

  const employee = await findEmployeeById(id)
  if (!employee) notFound()

  const workStatusContext = await loadWorkStatusContext()
  const workStatus = resolveWorkStatus(employee.id, workStatusContext)

  // Same real employee.managerId chain the Organization Chart page builds
  // from — one extra findAllEmployees() call (not per-ancestor), reused
  // here purely to trace this one employee's reporting line upward.
  const [allEmployeeProfiles, branches] = await Promise.all([findAllEmployees(), findAllBranches()])
  const branchesById = toBranchesById(branches)
  const allEmployees = allEmployeeProfiles.map((profile) => toListItem(profile, branchesById))
  const managerChain = buildManagerChain(id, allEmployees)
  // The Employment tab's "İş Yeri" — resolved the same way the list/card
  // view is, so a Branch rename shows up here too without rewriting this
  // employee's own record.
  const resolvedWorkLocation = employee.employment.branchId
    ? branchesById.get(employee.employment.branchId)?.name ?? employee.employment.workLocation
    : employee.employment.workLocation

  const disciplinaryActions = await listDisciplinaryActions(employee.id)
  const leaveEntitlement = summarizeEntitlement(resolveAnnualLeaveEntitlement(employee))

  const backHref = returnTo && returnTo.startsWith("/employees") ? returnTo : "/employees"

  return (
    <ProfileView
      profile={employee}
      workStatus={workStatus}
      backHref={backHref}
      penalty={activePenalty(disciplinaryActions, new Date().toISOString().slice(0, 10))}
      managerChain={managerChain}
      resolvedWorkLocation={resolvedWorkLocation}
      leaveEntitlement={leaveEntitlement}
      disciplinaryActions={disciplinaryActions}
    />
  )
}
