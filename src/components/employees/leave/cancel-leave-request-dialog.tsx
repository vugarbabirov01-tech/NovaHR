"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/common/field"
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

interface CancelLeaveRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  description: string
  onConfirm: (reason: string) => void
  isCancelling: boolean
  error?: string | null
}

/**
 * HR's one way to retract an already-approved leave now that there's no
 * reject step to fall back on (see submitLeaveRequestAction — every
 * request is created APPROVED). Not built on the shared
 * master-data/confirm-delete-dialog.tsx: that one's confirm button is
 * hardcoded to "Delete" copy for Administration's permanent-delete flows —
 * cancelling a leave is a status change (cancelLeaveRequestAction reverses
 * its ledger entry, it doesn't destroy the row), a different enough action
 * to warrant its own small dialog rather than stretching that one's wording.
 */
export function CancelLeaveRequestDialog({
  open,
  onOpenChange,
  description,
  onConfirm,
  isCancelling,
  error,
}: CancelLeaveRequestDialogProps) {
  const t = useTranslations("Employees.profile.leave.cancelDialog")
  const tCommon = useTranslations("Common")
  const [reason, setReason] = useState("")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setReason("")
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Field label={t("reasonLabel")} htmlFor="cancel-leave-reason" hint={t("reasonHint")}>
          <Textarea
            id="cancel-leave-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isCancelling} />}>{tCommon("cancel")}</DialogClose>
          <Button variant="destructive" onClick={() => onConfirm(reason)} disabled={isCancelling}>
            {isCancelling ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {t("confirmButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
