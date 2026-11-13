import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { CandidatesClient, type CandidateRow } from "@/components/recruitment/candidates-client"
import { RecruitmentTabs } from "@/components/recruitment/recruitment-tabs"
import { listCandidates } from "@/lib/recruitment/recruitment-service"

type Props = {
  params: Promise<{ locale: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Pages.recruitment" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function CandidatesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Pages.recruitment")
  const candidates = await listCandidates()

  const rows: CandidateRow[] = candidates.map((candidate) => ({
    id: candidate.id,
    fullName: `${candidate.lastName} ${candidate.firstName} ${candidate.fatherName}`.trim(),
    phone: candidate.phone,
    email: candidate.email,
    finCode: candidate.finCode,
    source: candidate.source,
    createdAt: candidate.createdAt.toISOString(),
    applications: candidate.applications.map((application) => ({
      requisitionId: application.requisition.id,
      code: application.requisition.code,
      title: application.requisition.title,
      stage: application.stage,
    })),
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />
      <RecruitmentTabs />
      <CandidatesClient rows={rows} />
    </div>
  )
}
