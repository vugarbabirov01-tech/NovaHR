"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface SaveReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  initialName: string
  initialDescription: string
  isSaving: boolean
  error: string | null
  onConfirm: (name: string, description: string) => void
}

export function SaveReportDialog({
  open,
  onOpenChange,
  mode,
  initialName,
  initialDescription,
  isSaving,
  error,
  onConfirm,
}: SaveReportDialogProps) {
  const t = useTranslations("Reports.builder")
  const tCommon = useTranslations("Common")
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setDescription(initialDescription)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("saveDialogCreateTitle") : t("saveDialogEditTitle")}</DialogTitle>
          <DialogDescription>{t("saveDialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-name">{t("nameLabel")}</Label>
            <Input
              id="report-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              aria-invalid={error ? true : undefined}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-description">{t("descriptionLabel")}</Label>
            <Textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isSaving} />}>{tCommon("cancel")}</DialogClose>
          <Button onClick={() => onConfirm(name, description)} disabled={isSaving || name.trim().length === 0}>
            {isSaving ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {mode === "create" ? t("saveButton") : t("updateButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
