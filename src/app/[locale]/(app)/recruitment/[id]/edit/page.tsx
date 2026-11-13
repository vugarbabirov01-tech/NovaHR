import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { RequisitionForm } from "@/components/recruitment/requisition-form"
import { getRequisitionDetail } from "@/lib/recruitment/recruitment-service"
import { isRequisitionEditable, type RequisitionStatus } from "@/lib/recruitment/recruitment-rules"
import { findActiveBranches } from "@/repositories/branch-repository"
import { findActiveDepartments } from "@/repositories/department-repository"

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Recruitment.form" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("editTitle")} | ${common("appName")}` }
}

export default async function EditVacancyPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const requisition = await getRequisitionDetail(id)
  if (!requisition) notFound()
  // Only a draft or rejected vacancy can be edited; otherwise go back to its page.
  if (!isRequisitionEditable(requisition.status as RequisitionStatus)) redirect(`/${locale}/recruitment/${id}`)

  const t = await getTranslations("Recruitment.form")
  const [departments, branches] = await Promise.all([findActiveDepartments(), findActiveBranches()])

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("editTitle")} description={requisition.code} />
      <RequisitionForm
        requisitionId={requisition.id}
        initial={{
          title: requisition.title,
          departmentId: requisition.departmentId ?? "",
          branchId: requisition.branchId ?? "",
          openings: String(requisition.openings),
          salaryMin: requisition.salaryMin?.toString() ?? "",
          salaryMax: requisition.salaryMax?.toString() ?? "",
          reason: requisition.reason,
          description: requisition.description,
        }}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  )
}
