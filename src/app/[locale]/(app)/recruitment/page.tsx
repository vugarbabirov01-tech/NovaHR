import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Briefcase, CheckCircle2, Clock, Users } from "lucide-react"

import { PageTitle } from "@/components/common/page-title"
import { KpiCard } from "@/components/common/kpi-card"
import { RecruitmentTabs } from "@/components/recruitment/recruitment-tabs"
import { VacanciesClient, type VacancyRow } from "@/components/recruitment/vacancies-client"
import { buttonVariants } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { VacantPlaces } from "@/components/recruitment/vacant-places"
import { listRequisitions, listVacantPlaces } from "@/lib/recruitment/recruitment-service"
import type { RequisitionStatus } from "@/lib/recruitment/recruitment-rules"
import { findAllBranches } from "@/repositories/branch-repository"
import { findAllDepartments } from "@/repositories/department-repository"

type Props = {
  params: Promise<{ locale: string }>
}

// Vacancies and candidates change with every action.
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Pages.recruitment" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function RecruitmentPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Pages.recruitment")
  const tRecruitment = await getTranslations("Recruitment")

  const [requisitions, departments, branches, vacantPlaces] = await Promise.all([
    listRequisitions(),
    findAllDepartments(),
    findAllBranches(),
    listVacantPlaces(),
  ])
  const departmentNames = new Map(departments.map((d) => [d.id, d.name]))
  const branchNames = new Map(branches.map((b) => [b.id, b.name]))

  const rows: VacancyRow[] = requisitions.map((requisition) => ({
    id: requisition.id,
    code: requisition.code,
    title: requisition.title,
    department: requisition.departmentId ? (departmentNames.get(requisition.departmentId) ?? "") : "",
    branch: requisition.branchId ? (branchNames.get(requisition.branchId) ?? "") : "",
    openings: requisition.openings,
    hired: requisition.applications.filter((a) => a.stage === "HIRED").length,
    activeCandidates: requisition.applications.filter((a) => !["HIRED", "REJECTED"].includes(a.stage)).length,
    status: requisition.status as RequisitionStatus,
    isReplacement: requisition.replacesEmployeeId !== null,
  }))

  const open = rows.filter((row) => row.status === "OPEN")
  const pending = rows.filter((row) => row.status === "PENDING_APPROVAL").length
  const inPipeline = open.reduce((sum, row) => sum + row.activeCandidates, 0)
  const filled = rows.filter((row) => row.status === "FILLED").length

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title={t("title")}
        description={t("description")}
        actions={
          <Link href="/recruitment/new" className={buttonVariants({ size: "sm" })}>
            {tRecruitment("list.newVacancy")}
          </Link>
        }
      />
      <RecruitmentTabs />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={tRecruitment("kpi.open")} value={String(open.length)} icon={Briefcase} />
        <KpiCard label={tRecruitment("kpi.pending")} value={String(pending)} icon={Clock} />
        <KpiCard label={tRecruitment("kpi.inPipeline")} value={String(inPipeline)} icon={Users} />
        <KpiCard label={tRecruitment("kpi.filled")} value={String(filled)} icon={CheckCircle2} />
      </div>
      <VacantPlaces places={vacantPlaces} />
      <VacanciesClient rows={rows} />
    </div>
  )
}
