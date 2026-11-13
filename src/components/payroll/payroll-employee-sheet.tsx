"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Trash2 } from "lucide-react"

import { addAdjustmentAction, deleteAdjustmentAction } from "@/app/[locale]/(app)/payroll/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { useRouter } from "@/i18n/navigation"
import { categoriesFor, type AdjustmentKind } from "@/lib/payroll/payroll-adjustments"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { buttonVariants } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { PayrollStatusBadge } from "@/components/payroll/payroll-status-badge"
import { getInitials } from "@/lib/employees"
import { formatReportDate } from "@/lib/reports/format-date"
import { formatAzn } from "@/lib/salary-import/apply-salary-update"
import type { PayrollEmployeeRow } from "@/types/payroll"

interface PayrollEmployeeSheetProps {
  row: PayrollEmployeeRow | null
  /** False once the period is approved: adjustments become read-only. */
  editable: boolean
  onOpenChange: (open: boolean) => void
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold text-foreground tabular-nums" : "text-foreground tabular-nums"}>{value}</span>
    </div>
  )
}

/** Side panel with one employee's pay breakdown for the open period. */
export function PayrollEmployeeSheet({ row, editable, onOpenChange }: PayrollEmployeeSheetProps) {
  const t = useTranslations("Payroll")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [kind, setKind] = useState<AdjustmentKind>("ADDITION")
  const [category, setCategory] = useState("bonus")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")

  function changeKind(next: AdjustmentKind) {
    setKind(next)
    setCategory(categoriesFor(next)[0])
  }

  function afterMutation(result: { success: true } | { success: false; code: string }) {
    if (result.success) router.refresh()
    else toast.error(t(`workflowError.${result.code}` as never))
  }

  function handleAdd() {
    if (!row) return
    const value = Number(amount.replace(",", "."))
    startTransition(async () => {
      const result = await addAdjustmentAction(row.id, { kind, category, amount: value, note })
      afterMutation(result)
      if (result.success) {
        setAmount("")
        setNote("")
      }
    })
  }

  function handleDelete(adjustmentId: string) {
    startTransition(async () => afterMutation(await deleteAdjustmentAction(adjustmentId)))
  }
  const tStatus = useTranslations("Payroll.status")

  const ratio =
    row && row.grossSalary && row.grossSalary > 0 ? `${Math.round((row.baseSalary / row.grossSalary) * 1000) / 10}%` : null

  return (
    <Sheet open={row !== null} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        {row ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={row.photoUrl} alt={row.fullName} />
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    {getInitials(row.firstName, row.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <SheetTitle className="truncate">{row.fullName}</SheetTitle>
                  <SheetDescription className="truncate">
                    {[row.position, row.workLocation].filter(Boolean).join(" · ")}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {t("columnFin")}: {row.finCode}
                </span>
                <PayrollStatusBadge status={row.status} label={tStatus(row.status)} />
              </div>
              {row.company ? <p className="text-sm text-muted-foreground">{row.company}</p> : null}

              <Separator />

              <div className="flex flex-col divide-y divide-border">
                <Line
                  label={t("columnGross")}
                  value={row.grossSalary !== undefined ? formatAzn(row.grossSalary) : "—"}
                />
                <Line label={t("columnNet")} value={formatAzn(row.baseSalary)} />
                {ratio ? <Line label={t("detailNetToGross")} value={ratio} /> : null}
                <Line label={t("columnAdditions")} value={`+${formatAzn(row.additions)}`} />
                <Line label={t("columnDeductions")} value={`−${formatAzn(row.deductions)}`} />
                <Line label={t("columnPayable")} value={formatAzn(row.netAmount)} strong />
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("adjustments.title")}
                </h3>
                {row.adjustments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("adjustments.empty")}</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {row.adjustments.map((adjustment) => (
                      <li
                        key={adjustment.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="text-foreground">{t(`adjustments.category.${adjustment.category}` as never)}</span>
                          {adjustment.note ? (
                            <span className="truncate text-xs text-muted-foreground">{adjustment.note}</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums">
                            {adjustment.kind === "ADDITION" ? "+" : "−"}
                            {formatAzn(adjustment.amount)}
                          </span>
                          {editable ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={pending}
                              aria-label={t("adjustments.delete")}
                              onClick={() => handleDelete(adjustment.id)}
                            >
                              <Trash2 className="size-3.5" strokeWidth={1.75} />
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {editable ? (
                  <div className="mt-1 flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
                    <div className="flex gap-2">
                      {(["ADDITION", "DEDUCTION"] as const).map((option) => (
                        <Button
                          key={option}
                          type="button"
                          size="sm"
                          variant={kind === option ? "default" : "outline"}
                          onClick={() => changeKind(option)}
                        >
                          {t(`adjustments.kind.${option}` as never)}
                        </Button>
                      ))}
                    </div>
                    <select
                      className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    >
                      {categoriesFor(kind).map((option) => (
                        <option key={option} value={option}>
                          {t(`adjustments.category.${option}` as never)}
                        </option>
                      ))}
                    </select>
                    <Input
                      inputMode="decimal"
                      placeholder={t("adjustments.amountPlaceholder")}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                    <Input
                      placeholder={t("adjustments.notePlaceholder")}
                      maxLength={300}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                    <Button size="sm" disabled={pending || amount.trim() === ""} onClick={handleAdd}>
                      {t("adjustments.add")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("adjustments.locked")}</p>
                )}
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("detailSalaryHistory")}
                </h3>
                {row.salaryHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("detailNoHistory")}</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {row.salaryHistory.map((event, index) => (
                      <li
                        key={`${event.date}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span className="text-foreground">{event.title}</span>
                        <span className="text-muted-foreground tabular-nums">{formatReportDate(event.date)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Link href={`/employees/${row.employeeId}`} className={buttonVariants({ variant: "outline" })}>
                {t("detailOpenProfile")}
              </Link>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
