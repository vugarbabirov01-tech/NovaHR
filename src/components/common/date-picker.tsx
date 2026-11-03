"use client"

import { useEffect, useRef, useState } from "react"
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

/** The digit-group lengths and separator a display format like
 * "dd.MM.yyyy" or "MM/dd/yyyy" breaks down into — e.g. [2, 2, 4] and ".".
 * Every locale's format is day/month/year in some order, always separated
 * by a single repeated punctuation character, so this one regex-plus-split
 * covers all of them without hardcoding per-locale digit positions. */
function getMaskSegments(displayFormat: string): { lengths: number[]; separator: string } {
  const separator = displayFormat.match(/[^A-Za-z]/)?.[0] ?? "."
  return { lengths: displayFormat.split(separator).map((segment) => segment.length), separator }
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

/** Rebuilds "dd.MM.yyyy"-shaped text from raw digits, inserting the
 * separator automatically as each segment fills — this is what lets
 * "15052025" and "15.05.2025" converge on the exact same result: any
 * separator the user typed themselves is discarded by digitsOnly() first,
 * then recreated here at the canonical positions. */
function applyDateMask(digits: string, lengths: number[], separator: string): string {
  let result = ""
  let pos = 0
  for (const length of lengths) {
    if (pos >= digits.length) break
    if (result) result += separator
    result += digits.slice(pos, pos + length)
    pos += length
  }
  return result
}

function digitCountBefore(text: string, index: number): number {
  return digitsOnly(text.slice(0, index)).length
}

/** The inverse of digitCountBefore — where the caret should land in the
 * freshly-masked text so it still sits after the same digit it did before
 * reformatting, instead of jumping to the end on every keystroke. */
function indexForDigitCount(maskedText: string, digitCount: number): number {
  if (digitCount <= 0) return 0
  let seen = 0
  for (let i = 0; i < maskedText.length; i++) {
    if (/\d/.test(maskedText[i])) {
      seen += 1
      if (seen === digitCount) return i + 1
    }
  }
  return maskedText.length
}

/**
 * Locale-driven replacement for native <input type="date">. A native date
 * input's calendar popup is rendered by the OS/browser chrome — it reads
 * the browser's own language setting, not this app's next-intl locale, so
 * switching the app to Azerbaijani never changed what the picker actually
 * showed. This one is rendered entirely in React via react-day-picker, so
 * every piece of it — month/year navigation, the Today/Clear actions, the
 * typed date format — is driven by useLocale(), never the browser.
 *
 * Also a real text field, not just a button: the user can type a date
 * (validated and parsed against the active locale's own format) as well as
 * pick one from the calendar popover — native <input type="date"> allowed
 * typing, so this has to as well. Typing is masked (digits only, dots
 * auto-inserted as each dd/MM/yyyy group fills) so "15052025" and
 * "15.05.2025" both land on the same result, matching how the native input
 * used to accept a plain digit run.
 */
export function DatePicker({ id, value, onChange, placeholder, disabled, className }: DatePickerProps) {
  const locale = useLocale() as AppLocale
  const t = useTranslations("Common.datePicker")
  const [open, setOpen] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const isFocused = useRef(false)

  const dateFnsLocale = dateFnsLocaleByAppLocale[locale]
  const displayFormat = dateInputFormatByAppLocale[locale]
  const { lengths: maskLengths, separator: maskSeparator } = getMaskSegments(displayFormat)
  const totalDigits = maskLengths.reduce((sum, length) => sum + length, 0)
  const maskedLength = totalDigits + maskLengths.length - 1

  function toText(iso: string): string {
    if (!iso) return ""
    const parsed = parse(iso, ISO_DATE_FORMAT, new Date())
    return isValid(parsed) ? format(parsed, displayFormat, { locale: dateFnsLocale }) : ""
  }

  const [text, setText] = useState(() => toText(value))

  // Reflects an externally-driven value change (calendar pick, form reset,
  // a different employee loaded) into the text field — but never while the
  // user is actively typing, or every keystroke's intermediate (still
  // incomplete) text would get stomped by the last-committed value.
  useEffect(() => {
    if (!isFocused.current) {
      setText(toText(value))
      setInvalid(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, locale])

  const parsedValue = value ? parse(value, ISO_DATE_FORMAT, new Date()) : undefined
  const selectedDate = parsedValue && isValid(parsedValue) ? parsedValue : undefined

  function selectDate(date: Date | undefined) {
    onChange(date ? format(date, ISO_DATE_FORMAT) : "")
    setOpen(false)
  }

  /** A real parse() plus a round-trip check — date-fns silently overflows
   * an out-of-range day instead of rejecting it (parsing "31.02.2025"
   * produces March 3rd rather than failing), and the same happens to
   * Feb 29 in a non-leap year. Reformatting the parsed date through the
   * same pattern and comparing it back to what was actually typed is what
   * catches both: a real date always round-trips to itself; an overflowed
   * one never does. */
  function parseStrict(maskedText: string): Date | undefined {
    const parsed = parse(maskedText, displayFormat, new Date(), { locale: dateFnsLocale })
    if (!isValid(parsed)) return undefined
    return format(parsed, displayFormat, { locale: dateFnsLocale }) === maskedText ? parsed : undefined
  }

  function commitFromText(maskedText: string) {
    if (!maskedText) {
      setInvalid(false)
      onChange("")
      return
    }
    if (maskedText.length < maskedLength) {
      // Incomplete — never flag an error before the user has even finished
      // typing a date; there's nothing to show red for yet.
      setInvalid(false)
      return
    }
    const parsed = parseStrict(maskedText)
    if (parsed) {
      setInvalid(false)
      onChange(format(parsed, ISO_DATE_FORMAT))
    } else {
      // A complete but impossible date (31.02.2025) — now there IS
      // something wrong to flag, immediately rather than waiting for blur.
      setInvalid(true)
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const inputEl = e.target
    const caretBefore = inputEl.selectionStart ?? inputEl.value.length
    const digitsBeforeCaret = digitCountBefore(inputEl.value, caretBefore)

    const digits = digitsOnly(inputEl.value).slice(0, totalDigits)
    const masked = applyDateMask(digits, maskLengths, maskSeparator)

    // Written back onto the DOM node directly (not just via React state) so
    // the caret can be repositioned in the same tick — restoring it after
    // the next render would land one keystroke late and feel laggy.
    inputEl.value = masked
    const newCaret = indexForDigitCount(masked, digitsBeforeCaret)
    inputEl.setSelectionRange(newCaret, newCaret)

    setText(masked)
    commitFromText(masked)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Backspace" && e.key !== "Delete") return
    const inputEl = e.currentTarget
    const { selectionStart, selectionEnd, value: rawValue } = inputEl
    if (selectionStart === null || selectionStart !== selectionEnd) return
    // The separator is auto-inserted and would just be recreated by the
    // next mask pass, so deleting it alone would look like Backspace/Delete
    // did nothing. Nudging the caret one more step first makes the
    // browser's default deletion remove the digit next to it instead.
    if (e.key === "Backspace" && selectionStart > 0 && /\D/.test(rawValue[selectionStart - 1] ?? "")) {
      inputEl.setSelectionRange(selectionStart - 1, selectionStart - 1)
    } else if (e.key === "Delete" && selectionStart < rawValue.length && /\D/.test(rawValue[selectionStart] ?? "")) {
      inputEl.setSelectionRange(selectionStart + 1, selectionStart + 1)
    }
  }

  function handleBlur() {
    isFocused.current = false
    if (!text) {
      setInvalid(false)
      return
    }
    if (text.length === maskedLength) {
      // Complete — leave it exactly as typed, including a red border if
      // it's not a real calendar date, so the mistake stays visible for
      // the user to fix instead of silently vanishing on blur.
      setInvalid(!parseStrict(text))
      return
    }
    // Incomplete — nothing actionable to leave on screen, so fall back to
    // the last committed value instead of a half-typed fragment.
    setText(toText(value))
    setInvalid(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "flex h-8 w-full min-w-0 items-center gap-1 rounded-lg border border-input bg-transparent pr-1 pl-2.5 text-base transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm dark:bg-input/30",
          invalid && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
          disabled && "pointer-events-none cursor-not-allowed bg-input/50 opacity-50",
          className
        )}
      >
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onFocus={() => (isFocused.current = true)}
          onBlur={handleBlur}
          placeholder={placeholder ?? displayFormat.toLowerCase()}
          disabled={disabled}
          aria-invalid={invalid}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={t("openCalendar")}
              disabled={disabled}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none"
            />
          }
        >
          <CalendarIcon className="size-4" strokeWidth={1.75} />
        </PopoverTrigger>
      </div>
      {/* disableAnchorTracking is the real fix for the month-navigation
       * jitter: Base UI's autoUpdate wires a ResizeObserver to BOTH the
       * anchor and the popup itself (despite the prop's name only
       * mentioning "anchor"). react-day-picker's month grid changes height
       * between a 4/5/6-week month, which fires that observer and triggers
       * a full flip/shift recompute on every Previous/Next click — that
       * recompute is what was producing the horizontal jump, not the
       * popup's open-time position. Disabling it means position is
       * computed once when the popover opens and never recalculated
       * because of the popup's own content size.
       *
       * collisionAvoidance.align must stay "shift" (not "none"): a field in
       * a right-hand column anchors align="start" near the viewport's right
       * edge, so a 288px-wide popup placed flush against that anchor can
       * extend past the viewport — and since positioning uses a CSS
       * transform, that overflow was widening <html>'s own scrollable area,
       * producing a real page-level horizontal scrollbar (confirmed via
       * document.documentElement.scrollWidth, not just a visual clip).
       * "shift" keeps side="bottom" and align="start" as the preference but
       * nudges the popup left to stay fully inside the viewport — it's a
       * one-time correction at open time, same as the position computation
       * itself, so it doesn't reintroduce the anchor-tracking jitter above. */}
      <PopoverContent
        align="start"
        collisionAvoidance={{ align: "shift" }}
        collisionPadding={12}
        disableAnchorTracking
        disableEnterExitMotion
        className="w-72 max-w-[calc(100vw-24px)] p-0"
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
