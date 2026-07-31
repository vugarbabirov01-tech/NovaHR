"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { format, isValid, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { dateFnsLocaleByAppLocale, dateInputFormatByAppLocale } from "@/lib/date-picker-locale"
import type { AppLocale } from "@/i18n/routing"

interface DatePickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

// The value/onChange contract stays the exact ISO "yyyy-MM-dd" string
// native <input type="date"> already used — this only replaces the input
// UI, not the data shape, so nothing downstream (validation, submission,
// evaluateLeaveRequest) needed to change.
const ISO_DATE_FORMAT = "yyyy-MM-dd"

/**
 * Locale-driven replacement for native <input type="date">. A native date
 * input's calendar popup is rendered by the OS/browser chrome — it reads
 * the browser's own language setting, not this app's next-intl locale, so
 * switching the app to Azerbaijani never changed what the picker actually
 * showed. This one is rendered entirely in React via react-day-picker, so
 * every piece of it — month/weekday names, the Today/Clear actions, the
 * typed date format — is driven by useLocale(), never the browser.
 */
export function DatePicker({ id, value, onChange, placeholder, disabled, className }: DatePickerProps) {
  const locale = useLocale() as AppLocale
  const t = useTranslations("Common.datePicker")
  const [open, setOpen] = useState(false)

  const dateFnsLocale = dateFnsLocaleByAppLocale[locale]
  const displayFormat = dateInputFormatByAppLocale[locale]

  const parsedValue = value ? parse(value, ISO_DATE_FORMAT, new Date()) : undefined
  const selectedDate = parsedValue && isValid(parsedValue) ? parsedValue : undefined

  function selectDate(date: Date | undefined) {
    onChange(date ? format(date, ISO_DATE_FORMAT) : "")
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            id={id}
            disabled={disabled}
            className={cn(
              "flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30",
              className
            )}
          />
        }
      >
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <span className={cn("truncate text-left", !selectedDate && "text-muted-foreground")}>
          {selectedDate ? format(selectedDate, displayFormat, { locale: dateFnsLocale }) : (placeholder ?? t("placeholder"))}
        </span>
      </PopoverTrigger>
      {/* disableAnchorTracking is the real fix: Base UI's autoUpdate wires a
       * ResizeObserver to BOTH the anchor and the popup itself (despite the
       * prop's name only mentioning "anchor"). react-day-picker's month
       * grid changes height between a 4/5/6-week month, which fires that
       * observer and triggers a full flip/shift recompute on every
       * Previous/Next click — that recompute is what was producing the
       * horizontal jump, not the popup's open-time position. Disabling it
       * means position is computed once when the popover opens and never
       * recalculated because of the popup's own content size — only a
       * genuine anchor scroll (still tracked separately) can move it. Fixed
       * width + locked alignment (`collisionAvoidance={{ align: "none" }}`)
       * stay as defense in depth against the same class of drift. */}
      <PopoverContent
        align="start"
        collisionAvoidance={{ align: "none" }}
        disableAnchorTracking
        className="w-72 p-0"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => selectDate(date)}
          locale={dateFnsLocale}
          labels={{
            labelNext: () => t("nextMonth"),
            labelPrevious: () => t("previousMonth"),
          }}
          autoFocus
        />
        <div className="flex items-center justify-between gap-2 border-t border-border p-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => selectDate(new Date())}>
            {t("today")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => selectDate(undefined)}
            disabled={!selectedDate}
          >
            {t("clear")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
