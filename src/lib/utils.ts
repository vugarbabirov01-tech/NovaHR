import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date as "D Mon YYYY" using a translated short-month array.
 * Bypasses Intl.DateTimeFormat, whose month names are unreliable for
 * some locales (e.g. Chromium's ICU data returns "M08" for az).
 */
export function formatShortDate(date: Date, monthsShort: string[]) {
  return `${date.getUTCDate()} ${monthsShort[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/**
 * Formats a date as "D Month YYYY" (e.g. "4 Aprel 2023") using a
 * translated full-month-name array (Common.months) — the long-form sibling
 * of formatShortDate above, same reasoning: Intl.DateTimeFormat's month
 * names are unreliable for some locales in this stack (Chromium's ICU
 * returns "M08" instead of a real month name for "az"), so this reads
 * names from the app's own translation messages instead.
 *
 * Accepts a stored date-only ("YYYY-MM-DD") string directly, not just a
 * Date — `new Date("YYYY-MM-DD")` parses as UTC midnight, and this reads
 * it back with the matching UTC getters, so the calendar day shown can
 * never shift a day forward/back with the runtime's local timezone (the
 * exact bug plain `.toLocaleDateString()`/`getDate()` on a date-only value
 * is prone to). getUTCDate() already returns an unpadded number (4, not
 * "04"), so no separate no-leading-zero handling is needed.
 */
export function formatLongDate(date: string | Date, months: string[]): string {
  const parsed = typeof date === "string" ? new Date(date) : date
  return `${parsed.getUTCDate()} ${months[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`
}
