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
import { SearchableSelect } from "@/components/common/searchable-select"
import type { Position, PositionInput } from "@/repositories/position-repository"

interface PositionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: PositionInput) => void
  isSaving?: boolean
  /** Pass an existing position to edit it instead of creating a new one. */
  position?: Position
  /** Only id/name are read — accepts both full Department rows and the
   *  lighter master-data snapshot the Employee Wizard's Quick Create uses. */
  departments: { id: string; name: string }[]
  /** Preselect a department (e.g. the one already chosen in the wizard). */
  defaultDepartmentId?: string
}

export function PositionFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isSaving,
  position,
  departments,
  defaultDepartmentId,
}: PositionFormDialogProps) {
  const t = useTranslations("Pages.positions")
  const tCommon = useTranslations("Common")
  const isEditing = Boolean(position)

  const [title, setTitle] = useState(position?.title ?? "")
  const [departmentId, setDepartmentId] = useState(position?.departmentId ?? defaultDepartmentId ?? "")
  const [description, setDescription] = useState(position?.description ?? "")

  useEffect(() => {
    if (!open) return
    setTitle(position?.title ?? "")
    setDepartmentId(position?.departmentId ?? defaultDepartmentId ?? "")
    setDescription(position?.description ?? "")
  }, [open, position, defaultDepartmentId])

  function handleSave() {
    if (!title.trim() || !departmentId) return
    onSubmit({ title: title.trim(), departmentId, description: description.trim() || undefined })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{isEditing ? t("editDescription") : t("addDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label={t("fieldTitle")} htmlFor="positionFormTitle" required>
            <Input id="positionFormTitle" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label={t("fieldDepartment")} htmlFor="positionFormDepartment" required>
            <SearchableSelect
              id="positionFormDepartment"
              value={departmentId}
              onValueChange={setDepartmentId}
              options={departments.map((department) => ({ value: department.id, label: department.name }))}
              placeholder={tCommon("selectPlaceholder")}
              searchPlaceholder={tCommon("searchPlaceholder")}
              emptyText={tCommon("noResults")}
            />
          </Field>
          <Field label={t("fieldDescription")} htmlFor="positionFormDescription">
            <Textarea
              id="positionFormDescription"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isSaving} />}>{tCommon("cancel")}</DialogClose>
          <Button onClick={handleSave} disabled={!title.trim() || !departmentId || isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
