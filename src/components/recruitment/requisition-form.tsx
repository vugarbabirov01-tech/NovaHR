"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"

import { createRequisitionAction, updateRequisitionAction } from "@/app/[locale]/(app)/recruitment/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useRouter } from "@/i18n/navigation"
import { REQUISITION_REASONS } from "@/lib/recruitment/recruitment-rules"

interface Option {
  id: string
  name: string
}

export interface RequisitionFormValues {
  title: string
  departmentId: string
  branchId: string
  openings: string
  salaryMin: string
  salaryMax: string
  reason: string
  description: string
}

interface RequisitionFormProps {
  /** Set when editing an existing vacancy. */
  requisitionId?: string
  initial?: RequisitionFormValues
  departments: Option[]
  branches: Option[]
}

const EMPTY: RequisitionFormValues = {
  title: "",
  departmentId: "",
  branchId: "",
  openings: "1",
  salaryMin: "",
  salaryMax: "",
  reason: "NEW_POSITION",
  description: "",
}

function toNumber(value: string): number | null {
  const trimmed = value.trim().replace(",", ".")
  return trimmed === "" ? null : Number(trimmed)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

const selectClassName = "h-9 rounded-lg border border-input bg-background px-2 text-sm"

export function RequisitionForm({ requisitionId, initial, departments, branches }: RequisitionFormProps) {
  const t = useTranslations("Recruitment")
  const router = useRouter()
  const [values, setValues] = useState<RequisitionFormValues>(initial ?? EMPTY)
  const [pending, startTransition] = useTransition()

  const set = (key: keyof RequisitionFormValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }))

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const input = {
      title: values.title,
      departmentId: values.departmentId || null,
      branchId: values.branchId || null,
      openings: Number(values.openings),
      salaryMin: toNumber(values.salaryMin),
      salaryMax: toNumber(values.salaryMax),
      reason: values.reason,
      description: values.description,
    }
    startTransition(async () => {
      if (requisitionId) {
        const result = await updateRequisitionAction(requisitionId, input)
        if (result.success) router.push(`/recruitment/${requisitionId}`)
        else toast.error(t(`errors.${result.code}` as never))
      } else {
        const result = await createRequisitionAction(input)
        if (result.success) router.push(`/recruitment/${result.data.id}`)
        else toast.error(t(`errors.${result.code}` as never))
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <Field label={t("form.title")}>
        <Input value={values.title} maxLength={120} onChange={(e) => set("title")(e.target.value)} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("form.department")}>
          <select className={selectClassName} value={values.departmentId} onChange={(e) => set("departmentId")(e.target.value)}>
            <option value="">{t("form.notSet")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("form.branch")}>
          <select className={selectClassName} value={values.branchId} onChange={(e) => set("branchId")(e.target.value)}>
            <option value="">{t("form.notSet")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("form.openings")}>
          <Input type="number" min={1} max={500} value={values.openings} onChange={(e) => set("openings")(e.target.value)} />
        </Field>
        <Field label={t("form.salaryMin")}>
          <Input inputMode="decimal" value={values.salaryMin} onChange={(e) => set("salaryMin")(e.target.value)} />
        </Field>
        <Field label={t("form.salaryMax")}>
          <Input inputMode="decimal" value={values.salaryMax} onChange={(e) => set("salaryMax")(e.target.value)} />
        </Field>
      </div>
      <Field label={t("form.reason")}>
        <select className={selectClassName} value={values.reason} onChange={(e) => set("reason")(e.target.value)}>
          {REQUISITION_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {t(`reason.${reason}` as never)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("form.description")}>
        <Textarea rows={6} value={values.description} onChange={(e) => set("description")(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("form.saving") : t("form.save")}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => router.back()}>
          {t("form.cancel")}
        </Button>
      </div>
    </form>
  )
}
