import { Suspense } from "react"
import type { Metadata } from "next"
import { Loader2 } from "lucide-react"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { EmployeeListClient } from "@/components/employees/employee-list-client"
import { findAllEmployees } from "@/repositories/employee-repository"
import { toListItem } from "@/types/employee-profile"
import { resolveWorkStatus, type WorkStatus } from "@/lib/employee-work-status"
import { loadWorkStatusContext } from "@/lib/employee-work-status-loader"

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
  const employees = (await findAllEmployees()).map(toListItem)

  // One fetch for every employee's current work status, instead of one
  // per row — see loadWorkStatusContext's own doc comment. Plain Record,
  // not a Map, so it serializes across the Server -> Client boundary.
  const workStatusContext = await loadWorkStatusContext()
  const workStatusByEmployeeId: Record<string, WorkStatus> = {}
  for (const employee of employees) {
    workStatusByEmployeeId[employee.id] = resolveWorkStatus(employee.id, workStatusContext)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
          </div>
        }
      >
        <EmployeeListClient employees={employees} workStatusByEmployeeId={workStatusByEmployeeId} />
      </Suspense>
    </div>
  )
}
