import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"

import { PrintEmployeeCard } from "@/components/employees/print-employee-card"
import { getEmployeeById } from "@/data/employee-directory"
import { toListItem } from "@/types/employee-profile"

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export default async function EmployeeCardPrintPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const profile = getEmployeeById(id)
  if (!profile) notFound()

  return <PrintEmployeeCard employee={toListItem(profile)} />
}
