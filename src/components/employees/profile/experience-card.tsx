"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Lock, Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { InfoField, InfoGrid } from "@/components/common/info-field"
import { useRouter } from "@/i18n/navigation"
import { addDurations, calculateServiceDuration } from "@/lib/employees"
import { previewWorkBookReviewAction, saveWorkBookReviewAction, type WorkBookActionResult } from "@/lib/experience/work-book-actions"
import type { WorkBookReviewInput } from "@/lib/experience/work-book-review"
import { actualCompanyService, officialExperience, resolveExperience, reviewReasons } from "@/lib/experience/work-experience"
import type { EmployeeProfile, WorkBookStatus, WorkExperienceDuration } from "@/types/employee-profile"

type Preview = Extract<WorkBookActionResult, { success: true }>

const emptyPeriod = () => ({ organization: "", position: "", startDate: "", endDate: "" })

function initialForm(profile: EmployeeProfile): WorkBookReviewInput {
  const book = profile.labourLaw.workBook
  return {
    status: book?.status ?? "pending",
    declaredTotal: book?.declaredTotal ?? { years: 0, months: 0, days: 0 },
    periods: (book?.periods ?? []).map((p) => ({
      organization: p.organization,
      position: p.position ?? "",
      startDate: p.startDate,
      endDate: p.endDate,
    })),
    note: book?.note ?? "",
    reviewedBy: book?.reviewedBy ?? "",
  }
}

export function ExperienceCard({ profile }: { profile: EmployeeProfile }) {
  const t = useTranslations("Employees.profile.experience")
  const tLabour = useTranslations("Employees.profile.labourLaw")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<WorkBookReviewInput>(() => initialForm(profile))
  const [preview, setPreview] = useState<Preview | null>(null)
  const [pending, startTransition] = useTransition()

  const { labourLaw, employment } = profile
  const book = labourLaw.workBook
  const official = officialExperience(labourLaw)
  const resolved = resolveExperience(profile)
  const company = calculateServiceDuration(employment.hireDate)
  const total = addDurations(labourLaw.previousWorkExperience, company)
  const actual = actualCompanyService(employment)
  const reasons = book?.status === "pending" ? reviewReasons(profile) : []
  const duplicateRisk = reasons.includes("likelyDuplicate")

  const format = (d: WorkExperienceDuration) =>
    `${d.years} ${tLabour("durationYears")} ${d.months} ${tLabour("durationMonths")} ${d.days} ${tLabour("durationDays")}`

  // Any change invalidates the shown result.
  function update(patch: Partial<WorkBookReviewInput>) {
    setForm((f) => ({ ...f, ...patch }))
    setPreview(null)
  }

  function setPeriod(index: number, key: keyof ReturnType<typeof emptyPeriod>, value: string) {
    update({ periods: form.periods.map((p, i) => (i === index ? { ...p, [key]: value } : p)) })
  }

  function show() {
    setForm(initialForm(profile))
    setPreview(null)
    setOpen(true)
  }

  function run(save: boolean) {
    startTransition(async () => {
      const action = save ? saveWorkBookReviewAction : previewWorkBookReviewAction
      const result = await action(profile.id, form)
      if (!result.success) {
        toast.error(t(`errors.${result.code}` as never))
        return
      }
      if (!save) {
        setPreview(result)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{tLabour("sectionExperience")}</CardTitle>
          {book ? (
            <Badge variant={book.status === "confirmed" ? "default" : book.status === "pending" ? "destructive" : "secondary"}>
              {t(`status.${book.status}`)}
            </Badge>
          ) : null}
        </div>
        <Button size="sm" variant="outline" onClick={show}>
          {t("review")}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <InfoGrid>
          <InfoField
            label={t("official")}
            value={
              <span className="inline-flex items-center gap-1.5" title={t("officialLocked")}>
                {format(official)}
                <Lock className="size-3 text-muted-foreground" aria-label={t("officialLocked")} />
              </span>
            }
          />
          <InfoField label={t("declared")} value={book?.declaredTotal ? format(book.declaredTotal) : "—"} />
          <InfoField label={t("effective")} value={<strong>{format(labourLaw.previousWorkExperience)}</strong>} />
          <InfoField label={tLabour("companyServiceDuration")} value={format(company)} />
          <InfoField label={tLabour("totalWorkExperience")} value={<strong>{format(total)}</strong>} />
        </InfoGrid>

        <p className="text-xs text-muted-foreground">{t(`source.${resolved.source}`)}</p>

        {/* Company information only: set apart so it is not read as part of the leave figures above. */}
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3">
          <InfoGrid>
            <InfoField label={t("actualStart")} value={employment.actualStartDate || "—"} />
            <InfoField
              label={t("actualService")}
              value={actual ? `${actual.approximate ? "≈ " : ""}${format(actual.duration)}` : "—"}
            />
          </InfoGrid>
          <p className="text-xs text-muted-foreground">{t("actualHint")}</p>
        </div>

        {reasons.length > 0 && (
          <ul className="flex flex-col gap-1 text-xs text-destructive">
            {reasons.map((reason) => (
              <li key={reason}>{t(`reasons.${reason}`)}</li>
            ))}
          </ul>
        )}

        {book && book.periods.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {book.periods.map((p) => (
              <li key={p.id} className="flex flex-wrap gap-x-4 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="font-medium text-foreground">{p.organization}</span>
                {p.position ? <span className="text-muted-foreground">{p.position}</span> : null}
                <span className="text-muted-foreground tabular-nums">
                  {p.startDate} – {p.endDate}
                </span>
              </li>
            ))}
          </ul>
        )}

        {book?.reviewedBy ? (
          <p className="text-xs text-muted-foreground">
            {t("reviewedBy")}: {book.reviewedBy}
            {book.reviewedAt ? `, ${book.reviewedAt.slice(0, 10)}` : ""}
            {book.note ? ` — ${book.note}` : ""}
          </p>
        ) : null}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogHint")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {duplicateRisk && (
              <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {t("duplicateWarning")}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {t("official")}: <span className="text-foreground">{format(official)}</span>
            </p>

            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">{t("declared")}</p>
              <div className="grid grid-cols-3 gap-3">
                {(["years", "months", "days"] as const).map((key) => (
                  <label key={key} className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {tLabour(key === "years" ? "durationYears" : key === "months" ? "durationMonths" : "durationDays")}
                    <Input
                      type="number"
                      min={0}
                      max={key === "years" ? 70 : key === "months" ? 11 : 30}
                      value={form.declaredTotal[key]}
                      onChange={(e) => update({ declaredTotal: { ...form.declaredTotal, [key]: Number(e.target.value) || 0 } })}
                    />
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t("declaredHint")}</p>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">{t("periods")}</p>
              {form.periods.map((p, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-2">
                  <Input placeholder={t("organization")} aria-label={t("organization")} value={p.organization} onChange={(e) => setPeriod(index, "organization", e.target.value)} />
                  <Input placeholder={t("position")} aria-label={t("position")} value={p.position} onChange={(e) => setPeriod(index, "position", e.target.value)} />
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {t("startDate")}
                    <Input type="date" value={p.startDate} onChange={(e) => setPeriod(index, "startDate", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {t("endDate")}
                    <div className="flex gap-2">
                      <Input type="date" value={p.endDate} onChange={(e) => setPeriod(index, "endDate", e.target.value)} />
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={t("removePeriod")} onClick={() => update({ periods: form.periods.filter((_, i) => i !== index) })}>
                        <Trash2 className="size-3.5" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </label>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => update({ periods: [...form.periods, emptyPeriod()] })}>
                <Plus className="size-3.5" strokeWidth={1.75} />
                {t("addPeriod")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("periodsHint")}</p>
            </div>

            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("decision")}
              <select
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                value={form.status}
                onChange={(e) => update({ status: e.target.value as WorkBookStatus })}
              >
                {(["pending", "confirmed", "rejected"] as const).map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("note")}
              <Textarea rows={2} placeholder={t("notePlaceholder")} value={form.note} onChange={(e) => update({ note: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("reviewedBy")}
              <Input value={form.reviewedBy} onChange={(e) => update({ reviewedBy: e.target.value })} />
            </label>

            {preview && (
              <div role="status" className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p>
                  {t("effective")}: <strong>{format(preview.effective)}</strong>
                </p>
                <p>
                  {t("leaveDays")}: {preview.leaveDaysBefore} → <strong>{preview.leaveDaysAfter}</strong>
                </p>
                {preview.overlapEmasDays > 0 && <p className="text-destructive">{t("overlapEmas", { days: preview.overlapEmasDays })}</p>}
                {preview.overlapCurrentDays > 0 && (
                  <p className="text-destructive">{t("overlapCurrent", { days: preview.overlapCurrentDays })}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => run(false)}>
              {t("calculate")}
            </Button>
            <Button type="button" disabled={pending || !preview} onClick={() => run(true)}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
