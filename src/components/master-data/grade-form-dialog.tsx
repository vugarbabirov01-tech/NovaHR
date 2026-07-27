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
import type { Grade, GradeInput } from "@/repositories/grade-repository"

interface GradeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: GradeInput) => void
  isSaving?: boolean
  grade?: Grade
}

export function GradeFormDialog({ open, onOpenChange, onSubmit, isSaving, grade }: GradeFormDialogProps) {
  const t = useTranslations("Pages.grades")
  const tCommon = useTranslations("Common")
  const isEditing = Boolean(grade)
  const [name, setName] = useState(grade?.name ?? "")
  const [code, setCode] = useState(grade?.code ?? "")
  const [description, setDescription] = useState(grade?.description ?? "")

  useEffect(() => {
    if (!open) return
    setName(grade?.name ?? "")
    setCode(grade?.code ?? "")
    setDescription(grade?.description ?? "")
  }, [open, grade])

  function handleSave() {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), code: code.trim() || undefined, description: description.trim() || undefined })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{isEditing ? t("editDescription") : t("addDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label={t("fieldName")} htmlFor="gradeFormName" required>
            <Input id="gradeFormName" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label={t("fieldCode")} htmlFor="gradeFormCode" hint={t("fieldCodeHint")}>
            <Input id="gradeFormCode" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label={t("fieldDescription")} htmlFor="gradeFormDescription">
            <Textarea
              id="gradeFormDescription"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isSaving} />}>{tCommon("cancel")}</DialogClose>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
