"use client"

import { useEffect, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Gavel, Pencil, Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { EmptyState } from "@/components/common/empty-state"
import { useRouter } from "@/i18n/navigation"
import {
  addDisciplinaryActionAction,
  checkDisciplineDateAction,
  deleteDisciplinaryActionAction,
  updateDisciplinaryActionAction,
} from "@/lib/discipline/discipline-actions"
import {
  DISCIPLINE_TYPES,
  disciplineExpiryDate,
  isDisciplineInForce,
  isPenalty,
} from "@/lib/discipline/discipline-rules"
import type { DisciplinaryActionView } from "@/lib/discipline/discipline-service"
import { formatShortDate } from "@/lib/utils"

interface DisciplineTabProps {
  employeeId: string
  actions: DisciplinaryActionView[]
}

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = () => ({ type: "WARNING", issuedDate: today(), violationDate: today(), reason: "", basis: "" })

export function DisciplineTab({ employeeId, actions }: DisciplineTabProps) {
  const t = useTranslations("Employees.profile.discipline")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const monthsShort = tCommon.raw("monthsShort") as string[]
  const [editing, setEditing] = useState<DisciplinaryActionView | "new" | null>(null)
  const [deleting, setDeleting] = useState<DisciplinaryActionView | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [pending, startTransition] = useTransition()

  const [leave, setLeave] = useState<{ date: string; name: string } | null>(null)
  const formOpen = editing !== null

  // Art. 189.2: warn (without blocking) if the employee was on approved leave that day.
  useEffect(() => {
    if (!formOpen || !form.issuedDate) return
    let current = true
    void checkDisciplineDateAction(employeeId, form.issuedDate).then((name) => {
      if (current) setLeave(name ? { date: form.issuedDate, name } : null)
    })
    return () => {
      current = false
    }
  }, [employeeId, formOpen, form.issuedDate])

  const date = (iso: string) => formatShortDate(new Date(iso), monthsShort)
  const set = (key: keyof ReturnType<typeof emptyForm>) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  function openNew() {
    setForm(emptyForm())
    setEditing("new")
  }

  function openEdit(action: DisciplinaryActionView) {
    setForm({
      type: action.type,
      issuedDate: action.issuedDate,
      violationDate: action.violationDate,
      reason: action.reason,
      basis: action.basis,
    })
    setEditing(action)
  }

  function save() {
    startTransition(async () => {
      const result =
        editing === "new"
          ? await addDisciplinaryActionAction(employeeId, form)
          : await updateDisciplinaryActionAction((editing as DisciplinaryActionView).id, form)
      if (!result.success) {
        toast.error(t(`errors.${result.code}` as never))
        return
      }
      setEditing(null)
      router.refresh()
    })
  }

  function remove() {
    if (!deleting) return
    startTransition(async () => {
      const result = await deleteDisciplinaryActionAction(deleting.id)
      if (!result.success) {
        toast.error(t(`errors.${result.code}` as never))
        return
      }
      setDeleting(null)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="size-3.5" strokeWidth={1.75} />
          {t("add")}
        </Button>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <EmptyState icon={Gavel} title={t("empty")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {actions.map((action) => {
              const inForce = isDisciplineInForce(action.issuedDate, today())
              return (
                <li key={action.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{t(`types.${action.type}` as never)}</span>
                      {isPenalty(action.type) ? (
                        <Badge variant={inForce ? "default" : "secondary"}>{inForce ? t("inForce") : t("expired")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("notPenalty")}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={t("edit")} onClick={() => openEdit(action)}>
                        <Pencil className="size-3.5" strokeWidth={1.75} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={t("delete")} onClick={() => setDeleting(action)}>
                        <Trash2 className="size-3.5" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{action.reason}</p>
                  {action.basis && (
                    <p className="text-xs text-muted-foreground">
                      {t("basis")}: {action.basis}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t("issued")}: {date(action.issuedDate)} · {t("violation")}: {date(action.violationDate)}
                    {isPenalty(action.type)
                      ? ` · ${t("validUntil")}: ${date(disciplineExpiryDate(action.issuedDate))}`
                      : ""}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? t("addTitle") : t("editTitle")}</DialogTitle>
            <DialogDescription>{t("formHint")}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("type")}
              <select
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                value={form.type}
                onChange={(e) => set("type")(e.target.value)}
              >
                {DISCIPLINE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`types.${type}` as never)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t("violation")}
                <Input type="date" max={today()} value={form.violationDate} onChange={(e) => set("violationDate")(e.target.value)} required />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t("issued")}
                <Input type="date" max={today()} value={form.issuedDate} onChange={(e) => set("issuedDate")(e.target.value)} required />
              </label>
            </div>
            {leave && leave.date === form.issuedDate && isPenalty(form.type) && (
              <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                {t("onLeaveWarning", { leave: leave.name })}
              </p>
            )}
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("reason")}
              <Textarea rows={3} value={form.reason} onChange={(e) => set("reason")(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("basis")}
              <Input placeholder={t("basisPlaceholder")} value={form.basis} onChange={(e) => set("basis")(e.target.value)} />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(null)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t("saving") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteText")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setDeleting(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" disabled={pending} onClick={remove}>
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
