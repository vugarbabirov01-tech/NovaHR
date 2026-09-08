"use client"

import { AlertTriangle, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

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
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  isDeleting: boolean
  /** Set once the confirmed delete came back blocked (still referenced by other records) — shown instead of silently closing, since the user needs to know why nothing happened. */
  blockedReason?: string | null
}

/**
 * The one confirmation step every permanent-delete action in Administration
 * goes through — archive/restore never needed this (both are reversible),
 * but deleteDepartmentAction/deletePositionAction destroy data outright.
 * Generic over which record is being deleted; the caller supplies the
 * already-translated title/description/blocked text.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isDeleting,
  blockedReason,
}: ConfirmDeleteDialogProps) {
  const tCommon = useTranslations("Common")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {blockedReason ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{blockedReason}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isDeleting} />}>{tCommon("cancel")}</DialogClose>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {tCommon("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
