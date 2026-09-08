import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"

import { PrintEmployeeCard } from "@/components/employees/print-employee-card"
import { findEmployeeById } from "@/repositories/employee-repository"
import { toListItem } from "@/types/employee-profile"
import { resolveWorkStatus } from "@/lib/employee-work-status"
import { loadWorkStatusContext } from "@/lib/employee-work-status-loader"

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export default async function EmployeeCardPrintPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const profile = await findEmployeeById(id)
  if (!profile) notFound()

  const workStatusContext = await loadWorkStatusContext()
  const workStatus = resolveWorkStatus(profile.id, workStatusContext)

  return <PrintEmployeeCard employee={toListItem(profile)} workStatus={workStatus} />
}
