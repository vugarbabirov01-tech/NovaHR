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
import type { EmploymentType, EmploymentTypeInput } from "@/repositories/employment-type-repository"

interface EmploymentTypeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: EmploymentTypeInput) => void
  isSaving?: boolean
  employmentType?: EmploymentType
}

export function EmploymentTypeFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isSaving,
  employmentType,
}: EmploymentTypeFormDialogProps) {
  const t = useTranslations("Pages.employmentTypes")
  const tCommon = useTranslations("Common")
  const isEditing = Boolean(employmentType)
  const [name, setName] = useState(employmentType?.name ?? "")
  const [code, setCode] = useState(employmentType?.code ?? "")
  const [description, setDescription] = useState(employmentType?.description ?? "")

  useEffect(() => {
    if (!open) return
    setName(employmentType?.name ?? "")
    setCode(employmentType?.code ?? "")
    setDescription(employmentType?.description ?? "")
  }, [open, employmentType])

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
          <Field label={t("fieldName")} htmlFor="employmentTypeFormName" required>
            <Input id="employmentTypeFormName" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label={t("fieldCode")} htmlFor="employmentTypeFormCode" hint={t("fieldCodeHint")}>
            <Input id="employmentTypeFormCode" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label={t("fieldDescription")} htmlFor="employmentTypeFormDescription">
            <Textarea
              id="employmentTypeFormDescription"
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
