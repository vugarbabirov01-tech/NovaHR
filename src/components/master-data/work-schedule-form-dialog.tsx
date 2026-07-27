"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/common/field"
import type { WorkSchedule, WorkScheduleInput } from "@/repositories/work-schedule-repository"

interface WorkScheduleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: WorkScheduleInput) => void
  isSaving?: boolean
  schedule?: WorkSchedule
}

export function WorkScheduleFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isSaving,
  schedule,
}: WorkScheduleFormDialogProps) {
  const t = useTranslations("Pages.workSchedules")
  const tCommon = useTranslations("Common")
  const isEditing = Boolean(schedule)
  const [label, setLabel] = useState(schedule?.label ?? "")
  const [code, setCode] = useState(schedule?.code ?? "")
  const [description, setDescription] = useState(schedule?.description ?? "")

  useEffect(() => {
    if (!open) return
    setLabel(schedule?.label ?? "")
    setCode(schedule?.code ?? "")
    setDescription(schedule?.description ?? "")
  }, [open, schedule])

  function handleSave() {
    if (!label.trim()) return
    onSubmit({ label: label.trim(), code: code.trim() || undefined, description: description.trim() || undefined })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{isEditing ? t("editDescription") : t("addDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label={t("fieldLabel")} htmlFor="scheduleFormLabel" required>
            <Input id="scheduleFormLabel" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
          </Field>
          <Field label={t("fieldCode")} htmlFor="scheduleFormCode" hint={t("fieldCodeHint")}>
            <Input id="scheduleFormCode" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label={t("fieldDescription")} htmlFor="scheduleFormDescription">
            <Textarea
              id="scheduleFormDescription"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isSaving} />}>{tCommon("cancel")}</DialogClose>
          <Button onClick={handleSave} disabled={!label.trim() || isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
