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
import type { Branch, BranchInput } from "@/repositories/branch-repository"

interface BranchFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: BranchInput) => void
  isSaving?: boolean
  branch?: Branch
  /** Only id/name are read — accepts both full Company rows and the lighter
   *  master-data snapshot the Employee Wizard's Quick Create uses. */
  companies: { id: string; name: string }[]
  /** Preselect a company (e.g. the one already chosen in the wizard). */
  defaultCompanyId?: string
}

export function BranchFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isSaving,
  branch,
  companies,
  defaultCompanyId,
}: BranchFormDialogProps) {
  const t = useTranslations("Pages.branches")
  const tCommon = useTranslations("Common")
  const isEditing = Boolean(branch)

  const [name, setName] = useState(branch?.name ?? "")
  const [companyId, setCompanyId] = useState(branch?.companyId ?? defaultCompanyId ?? "")
  const [description, setDescription] = useState(branch?.description ?? "")

  useEffect(() => {
    if (!open) return
    setName(branch?.name ?? "")
    setCompanyId(branch?.companyId ?? defaultCompanyId ?? "")
    setDescription(branch?.description ?? "")
  }, [open, branch, defaultCompanyId])

  function handleSave() {
    if (!name.trim() || !companyId) return
    onSubmit({ name: name.trim(), companyId, description: description.trim() || undefined })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{isEditing ? t("editDescription") : t("addDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label={t("fieldName")} htmlFor="branchFormName" required>
            <Input id="branchFormName" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label={t("fieldCompany")} htmlFor="branchFormCompany" required>
            <SearchableSelect
              id="branchFormCompany"
              value={companyId}
              onValueChange={setCompanyId}
              options={companies.map((company) => ({ value: company.id, label: company.name }))}
              placeholder={tCommon("selectPlaceholder")}
              searchPlaceholder={tCommon("searchPlaceholder")}
              emptyText={tCommon("noResults")}
            />
          </Field>
          <Field label={t("fieldDescription")} htmlFor="branchFormDescription">
            <Textarea
              id="branchFormDescription"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isSaving} />}>{tCommon("cancel")}</DialogClose>
          <Button onClick={handleSave} disabled={!name.trim() || !companyId || isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
