import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { HireWizard } from "@/components/recruitment/hire-wizard"
import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { buildHireWizardData } from "@/lib/recruitment/hire-prefill"
import { RecruitmentError, getHireContext } from "@/lib/recruitment/recruitment-service"
import { getWizardMasterData } from "@/lib/wizard-master-data"

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Recruitment.hire" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function HirePage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  let application: Awaited<ReturnType<typeof getHireContext>>
  try {
    application = await getHireContext(id)
  } catch (error) {
    if (error instanceof RecruitmentError && error.code === "notFound") notFound()
    // Not ready to hire (no accepted offer, vacancy closed, already hired): back to the vacancy.
    const existing = await prisma.recruitmentApplication.findUnique({ where: { id }, select: { requisitionId: true } })
    redirect(existing ? `/${locale}/recruitment/${existing.requisitionId}` : `/${locale}/recruitment`)
  }

  const t = await getTranslations("Recruitment.hire")
  const masterData = await getWizardMasterData()
  const { candidate, requisition, offer } = application

  const initialData = buildHireWizardData({ candidate, requisition, offer }, masterData)

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title={t("title")}
        description={t("description", { name: `${candidate.lastName} ${candidate.firstName}`.trim(), code: requisition.code })}
      />
      <Link href={`/recruitment/${requisition.id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {t("back")}
      </Link>
      <HireWizard applicationId={application.id} masterData={masterData} initialData={initialData} />
    </div>
  )
}
