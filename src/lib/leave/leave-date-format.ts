import { formatShortDate } from "@/lib/utils"

/**
 * Locale-safe date display for the Leave module — every date shown here
 * (request dates, return-to-work date, holidays, ledger entries) used to
 * go through plain `.toLocaleDateString()`, which relies on
 * Intl.DateTimeFormat and the browser's own locale, not the app's chosen
 * one. That's the exact problem formatShortDate (src/lib/utils.ts) already
 * exists to work around — its own doc comment records that Chromium's ICU
 * data returns "M08" instead of a real month name for the "az" locale.
 * header.tsx already reuses formatShortDate this same way; this is a thin,
 * Leave-specific wrapper so every Leave component doesn't repeat the
 * `tCommon.raw("monthsShort")` + `new Date(iso)` boilerplate.
 */
export function formatLeaveDate(date: string | Date, monthsShort: string[]): string {
  return formatShortDate(new Date(date), monthsShort)
}
