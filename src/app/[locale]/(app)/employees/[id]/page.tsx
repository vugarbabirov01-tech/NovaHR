import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { ProfileHeader } from "@/components/employees/profile/profile-header"
import { EmployeeProfileTabs } from "@/components/employees/profile/employee-profile-tabs"
import { findAllEmployees, findEmployeeById } from "@/repositories/employee-repository"
import { getFullName } from "@/lib/employees"
import { resolveWorkStatus } from "@/lib/employee-work-status"
import { loadWorkStatusContext } from "@/lib/employee-work-status-loader"

type Props = {
  params: Promise<{ locale: string; id: string }>
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

export default async function EmployeeProfilePage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const employee = await findEmployeeById(id)
  if (!employee) notFound()

  const workStatusContext = await loadWorkStatusContext()
  const workStatus = resolveWorkStatus(employee.id, workStatusContext)

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader profile={employee} workStatus={workStatus} />
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
          </div>
        }
      >
        <EmployeeProfileTabs profile={employee} />
      </Suspense>
    </div>
  )
}
