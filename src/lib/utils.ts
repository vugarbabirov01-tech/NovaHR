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
