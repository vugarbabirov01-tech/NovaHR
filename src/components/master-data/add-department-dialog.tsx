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
import type { Department, DepartmentInput } from "@/repositories/department-repository"

interface AddDepartmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: DepartmentInput) => void
  isSaving?: boolean
  /** Pass an existing department to edit it instead of creating a new one. */
  department?: Department
}

export function AddDepartmentDialog({
  open,
  onOpenChange,
  onSubmit,
  isSaving,
  department,
}: AddDepartmentDialogProps) {
  const t = useTranslations("Pages.departments")
  const tCommon = useTranslations("Common")
  const isEditing = Boolean(department)
  const [name, setName] = useState(department?.name ?? "")
  const [code, setCode] = useState(department?.code ?? "")
  const [description, setDescription] = useState(department?.description ?? "")

  useEffect(() => {
    if (!open) return
    setName(department?.name ?? "")
    setCode(department?.code ?? "")
    setDescription(department?.description ?? "")
  }, [open, department])

  function handleSave() {
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{isEditing ? t("editDescription") : t("addDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label={t("fieldName")} htmlFor="newDepartmentName" required>
            <Input id="newDepartmentName" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label={t("fieldCode")} htmlFor="newDepartmentCode" hint={t("fieldCodeHint")}>
            <Input id="newDepartmentCode" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label={t("fieldDescription")} htmlFor="newDepartmentDescription">
            <Textarea
              id="newDepartmentDescription"
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
