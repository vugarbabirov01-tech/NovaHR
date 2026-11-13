"use client"

import { useTranslations } from "next-intl"

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
export function PayrollEmployeeSheet({ row, onOpenChange }: PayrollEmployeeSheetProps) {
  const t = useTranslations("Payroll")
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
