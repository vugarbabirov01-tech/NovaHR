"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PayrollPeriodSwitcherProps {
  year: number
  month: number // 1-12
  /** "01.08.2026 – 31.08.2026" — plain zero-padded numerics, never a month
   * name, so there's no Intl.DateTimeFormat ICU concern (see
   * formatLongDate's own doc comment in src/lib/utils.ts for why month
   * names specifically are the unreliable part). */
  rangeLabel: string
}

const YEAR_RANGE = 5

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

export function PayrollPeriodSwitcher({ year, month, rangeLabel }: PayrollPeriodSwitcherProps) {
  const t = useTranslations("Payroll")
  const tCommon = useTranslations("Common")
  const months = tCommon.raw("months") as string[]
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pendingYear, setPendingYear] = useState(year)
  const [pendingMonth, setPendingMonth] = useState(month)

  function goTo(nextYear: number, nextMonth: number) {
    router.push(`/payroll?year=${nextYear}&month=${pad2(nextMonth)}`)
  }

  function goToOffset(delta: number) {
    const zeroBased = month - 1 + delta
    const nextYear = year + Math.floor(zeroBased / 12)
    const nextMonth = ((zeroBased % 12) + 12) % 12
    goTo(nextYear, nextMonth + 1)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setPendingYear(year)
      setPendingMonth(month)
    }
    setOpen(nextOpen)
  }

  function handleApply() {
    setOpen(false)
    goTo(pendingYear, pendingMonth)
  }

  const yearOptions = Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, i) => year - YEAR_RANGE + i)

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" onClick={() => goToOffset(-1)} aria-label={t("previousMonth")}>
          <ChevronLeft className="size-4" strokeWidth={1.75} />
        </Button>

        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="min-w-40 justify-center font-medium" />
            }
          >
            {months[month - 1]} {year}
          </PopoverTrigger>
          <PopoverContent align="center" className="flex w-64 flex-col gap-3 p-4">
            <div className="grid grid-cols-2 gap-2">
              <Select value={String(pendingMonth)} onValueChange={(v) => setPendingMonth(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue>{() => months[pendingMonth - 1]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {months.map((label, index) => (
                    <SelectItem key={label} value={String(index + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(pendingYear)} onValueChange={(v) => setPendingYear(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue>{() => String(pendingYear)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleApply}>
              {t("applyPeriod")}
            </Button>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="icon-sm" onClick={() => goToOffset(1)} aria-label={t("nextMonth")}>
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </Button>
      </div>

      <span className="text-sm text-muted-foreground tabular-nums">{rangeLabel}</span>
    </div>
  )
}
