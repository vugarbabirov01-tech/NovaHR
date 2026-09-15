import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { AttendanceTenantSection } from "@/components/attendance/attendance-tenant-section"
import { attendanceProvider } from "@/lib/integrations/attendance-qr-provider"

type Props = {
  params: Promise<{ locale: string }>
}

// Today's check-in/check-out board changes all day as people scan — unlike
// the rest of this app's Prisma-backed pages (which bake into the static
// build and only refresh on redeploy), this one must never freeze on
// whatever AttendanceQR happened to return at build time. Forces a fresh
// attendanceProvider.getTodaySummaries() call on every request.
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Pages.attendance" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

export default async function AttendancePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Pages.attendance")
  const summaries = await attendanceProvider.getTodaySummaries()

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />

      {summaries.map((summary) => (
        <AttendanceTenantSection key={summary.tenantKey} summary={summary} />
      ))}
    </div>
  )
}
