"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { UserPlus } from "lucide-react"

import { addCandidateAction } from "@/app/[locale]/(app)/recruitment/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useRouter } from "@/i18n/navigation"
import { CANDIDATE_SOURCES } from "@/lib/recruitment/recruitment-rules"

interface Duplicate {
  id: string
  fullName: string
  phone: string
  email: string
  finCode: string
}

const EMPTY = { firstName: "", lastName: "", fatherName: "", phone: "", email: "", finCode: "", source: "OTHER", notes: "" }

export function AddCandidateDialog({ requisitionId }: { requisitionId: string }) {
  const t = useTranslations("Recruitment")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState(EMPTY)
  const [duplicates, setDuplicates] = useState<Duplicate[]>([])
  const [pending, startTransition] = useTransition()

  const set = (key: keyof typeof EMPTY) => (value: string) => setValues((v) => ({ ...v, [key]: value }))

  function close() {
    setOpen(false)
    setValues(EMPTY)
    setDuplicates([])
  }

  function submit(options?: { existingCandidateId?: string; confirmNew?: boolean }) {
    startTransition(async () => {
      const result = await addCandidateAction(requisitionId, values, options)
      if (!result.success) {
        toast.error(t(`errors.${result.code}` as never))
        return
      }
      if (result.data.status === "duplicates") {
        setDuplicates(result.data.duplicates)
        return
      }
      close()
      router.refresh()
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-3.5" strokeWidth={1.75} />
        {t("candidateForm.add")}
      </Button>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("candidateForm.title")}</DialogTitle>
            <DialogDescription>{t("candidateForm.description")}</DialogDescription>
          </DialogHeader>

          {duplicates.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t("candidateForm.duplicatesTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("candidateForm.duplicatesText")}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {duplicates.map((duplicate) => (
                  <li key={duplicate.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium text-foreground">{duplicate.fullName}</span>
                      <span className="text-xs text-muted-foreground">
                        {[duplicate.phone, duplicate.email, duplicate.finCode].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    <Button size="sm" disabled={pending} onClick={() => submit({ existingCandidateId: duplicate.id })}>
                      {t("candidateForm.useExisting")}
                    </Button>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <Button variant="outline" disabled={pending} onClick={() => setDuplicates([])}>
                  {t("candidateForm.back")}
                </Button>
                <Button variant="outline" disabled={pending} onClick={() => submit({ confirmNew: true })}>
                  {t("candidateForm.createNew")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <Input placeholder={t("candidateForm.lastName")} value={values.lastName} onChange={(e) => set("lastName")(e.target.value)} required />
                <Input placeholder={t("candidateForm.firstName")} value={values.firstName} onChange={(e) => set("firstName")(e.target.value)} required />
                <Input placeholder={t("candidateForm.fatherName")} value={values.fatherName} onChange={(e) => set("fatherName")(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder={t("candidateForm.phone")} inputMode="tel" value={values.phone} onChange={(e) => set("phone")(e.target.value)} />
                <Input placeholder={t("candidateForm.email")} type="email" value={values.email} onChange={(e) => set("email")(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder={t("candidateForm.finCode")} maxLength={7} value={values.finCode} onChange={(e) => set("finCode")(e.target.value)} />
                <select
                  className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                  value={values.source}
                  onChange={(e) => set("source")(e.target.value)}
                  aria-label={t("candidateForm.source")}
                >
                  {CANDIDATE_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {t(`source.${source}` as never)}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea placeholder={t("candidateForm.notes")} rows={3} value={values.notes} onChange={(e) => set("notes")(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t("candidateForm.contactHint")}</p>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={pending} onClick={close}>
                  {t("form.cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? t("form.saving") : t("candidateForm.save")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
