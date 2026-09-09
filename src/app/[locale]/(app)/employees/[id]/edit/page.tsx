import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { PageTitle } from "@/components/common/page-title"
import { EmployeeEditForm } from "@/components/employees/edit/employee-edit-form"
import { findEmployeeById } from "@/repositories/employee-repository"
import { getWizardMasterData } from "@/lib/wizard-master-data"
import { includeEmployeesCurrentArchivedAssignments, profileToWizardData } from "@/lib/employee-wizard-mapper"

type Props = {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ returnTo?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Employees.wizard" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("editTitle")} | ${common("appName")}` }
}

/**
 * Edit, as its own full page and its own flow — EmployeeEditForm, not the
 * multi-step EmployeeWizard /employees/new still uses unchanged. Add is a
 * multi-step onboarding sequence on purpose; Edit is meant for a quick,
 * single change (fix a phone number, swap a photo) and showing every
 * section at once, with one Save at the bottom, is what makes that fast.
 * This route only fetches the profile + master data server-side (same
 * shape Create's own page already fetches) — no edit business logic
 * (fields, validation, save) lives here.
 */
export default async function EditEmployeePage({ params, searchParams }: Props) {
  const { locale, id } = await params
  const { returnTo } = await searchParams
  setRequestLocale(locale)

  // Same validation as employees/[id]/page.tsx's own backHref — only ever
  // this app's own Employees list, never an arbitrary URL a crafted link
  // could supply (an open-redirect vector otherwise).
  const backHref = returnTo && returnTo.startsWith("/employees") ? returnTo : "/employees"

  const [profileResult, activeMasterData] = await Promise.all([findEmployeeById(id), getWizardMasterData()])
  if (!profileResult) notFound()
  const profile = profileResult

  // This employee's current department/position/company/work schedule may
  // have been archived since they were assigned to it (a real scenario
  // here, not hypothetical) — without this, that lookup in
  // profileToWizardData silently comes back empty, and Position — scoped to
  // whatever Department resolved to — has nothing to show. Only fetches the
  // full (active + archived) catalog when at least one of this employee's
  // own values isn't already in the active list, and only ever appends
  // that employee's own specific archived record(s) — never the whole
  // archived catalog — to what the dropdowns offer. See
  // includeEmployeesCurrentArchivedAssignments's own doc comment.
  const employment = profile.employment
  const needsArchivedLookup = Boolean(
    (employment.department && !activeMasterData.departments.some((d) => d.name === employment.department)) ||
      (employment.position && !activeMasterData.positions.some((p) => p.title === employment.position)) ||
      (employment.company && !activeMasterData.companies.some((c) => c.name === employment.company)) ||
      (employment.workSchedule && !activeMasterData.workSchedules.some((s) => s.label === employment.workSchedule))
  )

  const masterData = needsArchivedLookup
    ? includeEmployeesCurrentArchivedAssignments(
        profile,
        activeMasterData,
        await getWizardMasterData({ includeArchived: true })
      )
    : activeMasterData

  const t = await getTranslations("Employees.wizard")
  const tProfile = await getTranslations("Employees.profile")

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={backHref}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.75} />
        {tProfile("backToList")}
      </Link>
      <PageTitle title={t("editTitle")} description={t("editDescription")} />
      <div className="mx-auto w-full max-w-[1400px]">
        <EmployeeEditForm
          key={id}
          employeeId={id}
          initialData={profileToWizardData(profile, masterData)}
          masterData={masterData}
          returnTo={backHref}
        />
      </div>
    </div>
  )
}
