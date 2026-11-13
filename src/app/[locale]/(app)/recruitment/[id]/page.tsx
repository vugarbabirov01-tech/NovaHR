import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { PipelineBoard } from "@/components/recruitment/pipeline-board"
import type { ApplicationView } from "@/components/recruitment/recruitment-types"
import { RequisitionActions } from "@/components/recruitment/requisition-actions"
import { RequisitionStatusBadge } from "@/components/recruitment/requisition-status-badge"
import { Link } from "@/i18n/navigation"
import { formatReportDate } from "@/lib/reports/format-date"
import { acceptsApplications, type PipelineStage, type RequisitionStatus } from "@/lib/recruitment/recruitment-rules"
import { getRequisitionDetail, listRequisitionEvents } from "@/lib/recruitment/recruitment-service"
import { formatAzn } from "@/lib/salary-import/apply-salary-update"
import { findBranchById } from "@/repositories/branch-repository"
import { findDepartmentById } from "@/repositories/department-repository"

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params
  const requisition = await getRequisitionDetail(id)
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${requisition?.title ?? common("appName")} | ${common("appName")}` }
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || "—"}</dd>
    </div>
  )
}

export default async function VacancyPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const requisition = await getRequisitionDetail(id)
  if (!requisition) notFound()

  const t = await getTranslations("Recruitment")
  const status = requisition.status as RequisitionStatus
  const [department, branch, events] = await Promise.all([
    requisition.departmentId ? findDepartmentById(requisition.departmentId) : null,
    requisition.branchId ? findBranchById(requisition.branchId) : null,
    listRequisitionEvents(id),
  ])

  const applications: ApplicationView[] = requisition.applications.map((application) => ({
    id: application.id,
    stage: application.stage as PipelineStage,
    rejectionReason: application.rejectionReason,
    hiredEmployeeId: application.hiredEmployeeId,
    offer: application.offer
      ? {
          status: application.offer.status,
          salary: application.offer.salary,
          startDate: application.offer.startDate,
          note: application.offer.note,
        }
      : null,
    stageUpdatedAt: application.stageUpdatedAt.toISOString(),
    candidate: {
      id: application.candidate.id,
      fullName: `${application.candidate.lastName} ${application.candidate.firstName} ${application.candidate.fatherName}`.trim(),
      phone: application.candidate.phone,
      email: application.candidate.email,
      finCode: application.candidate.finCode,
      source: application.candidate.source,
      notes: application.candidate.notes,
    },
    notes: application.notes.map((note) => ({
      id: note.id,
      kind: note.kind === "INTERVIEW" ? "INTERVIEW" : "NOTE",
      text: note.text,
      rating: note.rating,
      createdAt: note.createdAt.toISOString(),
    })),
  }))

  const hired = applications.filter((application) => application.stage === "HIRED").length
  const salary =
    requisition.salaryMin != null || requisition.salaryMax != null
      ? [requisition.salaryMin, requisition.salaryMax].map((value) => (value != null ? formatAzn(value) : "…")).join(" – ")
      : ""

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title={requisition.title}
        description={requisition.code}
        actions={<RequisitionStatusBadge status={status} label={t(`status.${status}` as never)} />}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/recruitment" className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("detail.back")}
        </Link>
        <RequisitionActions requisitionId={requisition.id} status={status} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label={t("form.department")} value={department?.name ?? ""} />
          <Detail label={t("form.branch")} value={branch?.name ?? ""} />
          <Detail label={t("detail.openings")} value={`${hired} / ${requisition.openings}`} />
          <Detail label={t("detail.salary")} value={salary} />
          <Detail label={t("form.reason")} value={t(`reason.${requisition.reason}` as never)} />
          {requisition.replacesEmployeeId ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{t("detail.replaces")}</dt>
              <dd className="text-sm">
                <Link href={`/employees/${requisition.replacesEmployeeId}`} className="text-primary hover:underline">
                  {t("detail.openFormerEmployee")}
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>
        {requisition.description ? (
          <p className="mt-4 text-sm whitespace-pre-wrap text-muted-foreground">{requisition.description}</p>
        ) : null}
      </div>

      <PipelineBoard requisitionId={requisition.id} applications={applications} open={acceptsApplications(status)} />

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-foreground">{t("detail.history")}</h2>
        <ul className="flex flex-col gap-1.5">
          {events.map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <span className="text-foreground">
                {event.fromStatus ? `${t(`status.${event.fromStatus}` as never)} → ` : ""}
                {t(`status.${event.toStatus}` as never)}
                {event.note ? <span className="text-muted-foreground"> · {event.note}</span> : null}
              </span>
              <span className="text-muted-foreground tabular-nums">{formatReportDate(event.createdAt.toISOString())}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
