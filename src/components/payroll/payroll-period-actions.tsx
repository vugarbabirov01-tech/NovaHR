"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Undo2 } from "lucide-react"

import { transitionPeriodAction } from "@/app/[locale]/(app)/payroll/actions"
import { PayrollStatusBadge } from "@/components/payroll/payroll-status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { useRouter } from "@/i18n/navigation"
import { nextStatus, previousStatus } from "@/lib/payroll/payroll-workflow"
import type { PayrollPeriodStatus } from "@/types/payroll"

interface PayrollPeriodActionsProps {
  periodId: string
  status: PayrollPeriodStatus
}

/** Period status badge plus the next-step / step-back buttons. */
export function PayrollPeriodActions({ periodId, status }: PayrollPeriodActionsProps) {
  const t = useTranslations("Payroll")
  const tStatus = useTranslations("Payroll.status")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState<PayrollPeriodStatus | null>(null)

  const next = nextStatus(status)
  const previous = previousStatus(status)

  function run(target: PayrollPeriodStatus) {
    startTransition(async () => {
      const result = await transitionPeriodAction(periodId, target)
      setConfirm(null)
      if (result.success) router.refresh()
      else toast.error(t(`workflowError.${result.code}` as never))
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PayrollStatusBadge status={status} label={tStatus(status)} />
      {previous ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirm(previous)}>
          <Undo2 className="size-3.5" strokeWidth={1.75} />
          {t("workflow.back")}
        </Button>
      ) : null}
      {next ? (
        <Button size="sm" disabled={pending} onClick={() => setConfirm(next)}>
          {t(`workflow.to${next}` as never)}
        </Button>
      ) : null}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm ? t(`workflow.confirmTitle.${confirm}` as never) : ""}</DialogTitle>
            <DialogDescription>{confirm ? t(`workflow.confirmText.${confirm}` as never) : ""}</DialogDescription>
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
