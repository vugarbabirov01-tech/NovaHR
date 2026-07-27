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
import type { Company, CompanyInput } from "@/repositories/company-repository"

interface CompanyFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CompanyInput) => void
  isSaving?: boolean
  company?: Company
}

export function CompanyFormDialog({ open, onOpenChange, onSubmit, isSaving, company }: CompanyFormDialogProps) {
  const t = useTranslations("Pages.companies")
  const tCommon = useTranslations("Common")
  const isEditing = Boolean(company)
  const [name, setName] = useState(company?.name ?? "")
  const [code, setCode] = useState(company?.code ?? "")
  const [description, setDescription] = useState(company?.description ?? "")

  useEffect(() => {
    if (!open) return
    setName(company?.name ?? "")
    setCode(company?.code ?? "")
    setDescription(company?.description ?? "")
  }, [open, company])

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
          <Field label={t("fieldName")} htmlFor="companyFormName" required>
            <Input id="companyFormName" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label={t("fieldCode")} htmlFor="companyFormCode" hint={t("fieldCodeHint")}>
            <Input id="companyFormCode" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label={t("fieldDescription")} htmlFor="companyFormDescription">
            <Textarea
              id="companyFormDescription"
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
