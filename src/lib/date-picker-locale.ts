import { az, enUS, ru } from "react-day-picker/locale"
import type { Locale } from "date-fns"

import type { AppLocale } from "@/i18n/routing"

/**
 * date-fns locale objects (re-exported by react-day-picker for type
 * compatibility with its own `locale` prop) driving every Calendar's month
 * and weekday names — keyed by next-intl's own locale codes, never read
 * from the browser. This is "the localization support of the existing
 * Date Picker library" the calendar is required to use: react-day-picker
 * bundles its own locale data and formats dates through it directly, so
 * there's no dependency on Intl.DateTimeFormat and none of the unreliable
 * ICU behavior formatShortDate (src/lib/utils.ts) already had to work
 * around for plain-text date display.
 */
export const dateFnsLocaleByAppLocale: Record<AppLocale, Locale> = {
  az,
  en: enUS,
  ru,
}

/**
 * The numeric format each locale's date picker input displays and parses
 * — the one place this mapping is defined, so every DatePicker consumer
 * renders and reads dates identically. az/ru share day.month.year (the
 * regional convention in both); en uses the US month/day/year convention.
 */
export const dateInputFormatByAppLocale: Record<AppLocale, string> = {
  az: "dd.MM.yyyy",
  ru: "dd.MM.yyyy",
  en: "MM/dd/yyyy",
}
