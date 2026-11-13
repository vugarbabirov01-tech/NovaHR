"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"

import { saveOfferAction, transitionOfferAction } from "@/app/[locale]/(app)/recruitment/actions"
import type { ApplicationView } from "@/components/recruitment/recruitment-types"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { Link, useRouter } from "@/i18n/navigation"
import { formatReportDate } from "@/lib/reports/format-date"
import { formatAzn } from "@/lib/salary-import/apply-salary-update"
import { canStartHire, isOfferEditable, nextOfferStatuses, type OfferStatus } from "@/lib/recruitment/recruitment-rules"

interface OfferSectionProps {
  application: ApplicationView
  /** Vacancy is open, so offers can be created and changed. */
  canEdit: boolean
}

/** Offer form, offer status buttons and the "Hire" entry point inside the candidate panel. */
export function OfferSection({ application, canEdit }: OfferSectionProps) {
  const t = useTranslations("Recruitment")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const offer = application.offer
  const [salary, setSalary] = useState(offer ? String(offer.salary) : "")
  const [startDate, setStartDate] = useState(offer?.startDate ?? "")
  const [note, setNote] = useState(offer?.note ?? "")

  const status = (offer?.status ?? null) as OfferStatus | null
  const editable = canEdit && application.stage === "OFFER" && (!status || isOfferEditable(status))

  function done(result: { success: true } | { success: false; code: string }) {
    if (result.success) router.refresh()
    else toast.error(t(`errors.${result.code}` as never))
  }

  function handleSave() {
    startTransition(async () =>
      done(await saveOfferAction(application.id, { salary: Number(salary.replace(",", ".")), startDate, note }))
    )
  }

  function handleTransition(to: OfferStatus) {
    startTransition(async () => done(await transitionOfferAction(application.id, to)))
  }

  // Nothing to show for an application that never reached the offer stage.
  if (!offer && application.stage !== "OFFER") return null

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("offer.title")}</h3>

      {offer ? (
        <div className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("offer.status")}</span>
            <span className="font-medium text-foreground">{t(`offer.statusLabel.${offer.status}` as never)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("offer.salary")}</span>
            <span className="tabular-nums">{formatAzn(offer.salary)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("offer.startDate")}</span>
            <span className="tabular-nums">{formatReportDate(offer.startDate)}</span>
          </div>
          {offer.note ? <p className="pt-1 text-muted-foreground">{offer.note}</p> : null}
        </div>
      ) : null}

      {editable ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              inputMode="decimal"
              placeholder={t("offer.salaryPlaceholder")}
              value={salary}
              onChange={(event) => setSalary(event.target.value)}
            />
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label={t("offer.startDate")} />
          </div>
          <Input
            placeholder={t("offer.notePlaceholder")}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button size="sm" disabled={pending || !salary.trim() || !startDate} onClick={handleSave}>
            {offer ? t("offer.update") : t("offer.create")}
          </Button>
        </div>
      ) : null}

      {canEdit && offer && status
        ? nextOfferStatuses(status).map((target) => (
            <Button
              key={target}
              size="sm"
              variant={target === "DECLINED" || target === "DRAFT" ? "outline" : "default"}
              disabled={pending}
              onClick={() => handleTransition(target)}
            >
              {t(`offer.move.${status}_${target}` as never)}
            </Button>
          ))
        : null}

      {canEdit && canStartHire(application.stage, status) ? (
        <Link href={`/recruitment/hire/${application.id}`} className={buttonVariants({ size: "sm" })}>
          {t("offer.hire")}
        </Link>
      ) : null}

      {application.stage === "HIRED" && application.hiredEmployeeId ? (
        <Link href={`/employees/${application.hiredEmployeeId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {t("offer.openEmployee")}
        </Link>
      ) : null}
    </div>
  )
}
