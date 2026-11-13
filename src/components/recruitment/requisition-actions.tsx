"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"

import { transitionRequisitionAction } from "@/app/[locale]/(app)/recruitment/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { Link, useRouter } from "@/i18n/navigation"
import { isRequisitionEditable, nextRequisitionStatuses, type RequisitionStatus } from "@/lib/recruitment/recruitment-rules"

interface RequisitionActionsProps {
  requisitionId: string
  status: RequisitionStatus
}

/** Status transition buttons for one vacancy; the first allowed move is the primary one. */
export function RequisitionActions({ requisitionId, status }: RequisitionActionsProps) {
  const t = useTranslations("Recruitment")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState<RequisitionStatus | null>(null)

  // Reverting a pending approval to draft is a secondary action, shown as an outline button.
  const moves = nextRequisitionStatuses(status)
  // Labels depend on where the move starts (e.g. PENDING_APPROVAL -> OPEN is "Approve", CLOSED -> OPEN is "Reopen").
  const moveKey = (target: RequisitionStatus) => `${status}_${target}`

  function run(target: RequisitionStatus) {
    startTransition(async () => {
      const result = await transitionRequisitionAction(requisitionId, target)
      setConfirm(null)
      if (result.success) router.refresh()
      else toast.error(t(`errors.${result.code}` as never))
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isRequisitionEditable(status) ? (
        <Link href={`/recruitment/${requisitionId}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {t("workflow.edit")}
        </Link>
      ) : null}
      {moves.map((target, index) => (
        <Button
          key={target}
          size="sm"
          variant={index === 0 ? "default" : "outline"}
          disabled={pending}
          onClick={() => setConfirm(target)}
        >
          {t(`workflow.move.${moveKey(target)}` as never)}
        </Button>
      ))}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm ? t(`workflow.confirmTitle.${moveKey(confirm)}` as never) : ""}</DialogTitle>
            <DialogDescription>{confirm ? t(`workflow.confirmText.${moveKey(confirm)}` as never) : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setConfirm(null)}>
              {t("workflow.cancel")}
            </Button>
            <Button disabled={pending} onClick={() => confirm && run(confirm)}>
              {t("workflow.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
