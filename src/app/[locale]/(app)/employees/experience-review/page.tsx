import type { Metadata } from "next"
import { ArrowLeft } from "lucide-react"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import { getFullLegalName } from "@/lib/employees"
import { officialExperience, resolveExperience, reviewReasons } from "@/lib/experience/work-experience"
import { resolveAnnualLeaveEntitlement } from "@/lib/leave/leave-policy-resolution-service"
import { findAllEmployees } from "@/repositories/employee-repository"
import type { EmployeeProfile, WorkExperienceDuration } from "@/types/employee-profile"

type Props = { params: Promise<{ locale: string }> }

// The queue changes with every HR decision.
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Employees.experienceReview" })
  return { title: t("title") }
}

/** Leave days now, and what they would become if HR confirmed the declared total. */
function leaveEffect(profile: EmployeeProfile) {
  const confirmed: EmployeeProfile = {
    ...profile,
    labourLaw: { ...profile.labourLaw, workBook: { ...profile.labourLaw.workBook!, status: "confirmed" } },
  }
  const after = {
    ...confirmed,
    labourLaw: { ...confirmed.labourLaw, previousWorkExperience: resolveExperience(confirmed).effective },
  }
  return {
    now: resolveAnnualLeaveEntitlement(profile).totalDays,
    ifConfirmed: resolveAnnualLeaveEntitlement(after).totalDays,
  }
}

export default async function ExperienceReviewPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("Employees.experienceReview")
  const tExperience = await getTranslations("Employees.profile.experience")
  const tLabour = await getTranslations("Employees.profile.labourLaw")

  const rows = (await findAllEmployees())
    .filter((employee) => employee.employmentStatus !== "terminated" && employee.labourLaw.workBook?.status === "pending")
    .map((employee) => ({ employee, reasons: reviewReasons(employee), leave: leaveEffect(employee) }))
    // Suspicious ones first, then by how much is at stake.
    .sort(
      (a, b) =>
        b.reasons.length - a.reasons.length || b.leave.ifConfirmed - b.leave.now - (a.leave.ifConfirmed - a.leave.now)
    )

  const format = (d: WorkExperienceDuration) =>
    `${d.years} ${tLabour("durationYears")} ${d.months} ${tLabour("durationMonths")} ${d.days} ${tLabour("durationDays")}`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/employees" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" strokeWidth={1.75} />
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description", { count: rows.length })}</p>
      </div>

      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">{t("employee")}</th>
                    <th className="py-2 pr-4 font-medium">{tExperience("official")}</th>
                    <th className="py-2 pr-4 font-medium">{tExperience("declared")}</th>
                    <th className="py-2 pr-4 font-medium">{tExperience("leaveDays")}</th>
                    <th className="py-2 font-medium">{t("reason")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ employee, reasons, leave }) => (
                    <tr key={employee.id} className="border-b border-border/60 align-top last:border-0">
                      <td className="py-2 pr-4">
                        <Link href={`/employees/${employee.id}?tab=labourLaw`} className="font-medium text-primary hover:underline">
                          {getFullLegalName(employee.personal)}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">{format(officialExperience(employee.labourLaw))}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {employee.labourLaw.workBook?.declaredTotal ? format(employee.labourLaw.workBook.declaredTotal) : "—"}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap tabular-nums">
                        {leave.now} → {leave.ifConfirmed}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {reasons.map((reason) => (
                            <Badge key={reason} variant={reason === "bookOnly" ? "secondary" : "outline"} className="h-auto whitespace-normal text-left">
                              {tExperience(`reasons.${reason}`)}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
