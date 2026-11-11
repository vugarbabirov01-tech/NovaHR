import { getEnumMessagePath, getReportFieldDefinition } from "@/lib/reports/field-registry"
import type { AnalyticsSpec, GroupByBucket } from "@/types/reports"

/**
 * The single place every analytics value (a KPI card, a chart tooltip, an
 * Excel Summary row) goes through before it reaches a human — so the same
 * raw number always reads the same way everywhere, and a future rendering
 * surface gets this for free instead of re-inventing its own rounding.
 *
 * Deliberately never mutates the number the aggregation engine computed —
 * that stays exact (an avg of 73.0796... months stays that precise value
 * internally); only the TEXT shown is chosen here, per the 2026-11-11
 * fix: "Hesablamanın dəqiqliyi itirilməsin" (don't lose computational
 * precision) while still never showing a bare, unit-less integer for a
 * field that isn't actually counted in whole units.
 */

/**
 * Locale-aware number formatting — "42,3" (az/ru, comma decimal) vs
 * "42.3" (en, period), "1 250" thousands separator, trailing zeros
 * dropped (maximumFractionDigits alone, no minimumFractionDigits, is
 * what makes 34 read as "34" rather than "34.00") — works identically
 * from a client component's `useFormatter().number` and a server
 * action's `getFormatter(...)`'s `.number`, same pattern as the date/
 * duration formatters below.
 */
export type NumberFormatter = (value: number, options?: { maximumFractionDigits?: number }) => string

/** A translator-agnostic callback so this works identically from a client
 * component's useTranslations and a server action's getTranslations. */
export type DurationFormatter = (totalMonths: number) => string

export function buildDurationFormatter(
  tFields: (key: string, params?: Record<string, string | number | Date>) => string
): DurationFormatter {
  return (totalMonths: number) => {
    const rounded = Math.round(totalMonths)
    return tFields("tenureDurationFormat", { years: Math.floor(rounded / 12), months: rounded % 12 })
  }
}

/** Parses a "month"/"year" groupBy bucket key (an ISO-ish "YYYY-MM" or
 * "YYYY", see AnalyticsPoint's own comment) back into a real Date so it
 * can go through next-intl's own date formatter — the one place both the
 * chart display and the Excel export turn that raw key into "Mart 2026"-
 * style, locale-correct text instead of the bare ISO string. */
export function parseDateBucketKey(key: string, bucket: "month" | "year"): Date | null {
  if (bucket === "year") {
    const year = Number(key)
    return Number.isInteger(year) ? new Date(year, 0, 1) : null
  }
  const [yearPart, monthPart] = key.split("-")
  const year = Number(yearPart)
  const month = Number(monthPart)
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null
  return new Date(year, month - 1, 1)
}

/** Only the two option shapes this module ever asks a date formatter
 * for — kept narrower than Intl.DateTimeFormatOptions/next-intl's own
 * DateTimeFormatOptions so this function works with either type's
 * formatter without fighting their slightly different option unions. */
export type DateBucketFormatOptions = { year: "numeric"; month?: "long" }

/** A translator-agnostic wrapper over next-intl's own `dateTime` formatter
 * (works from both `useFormatter().dateTime` on the client and
 * `getFormatter(...)`'s `.dateTime` on the server) — "Mart 2026" / "March
 * 2026" / "Март 2026" depending on locale, never a hardcoded language. */
export function formatDateBucketKey(
  key: string,
  bucket: "month" | "year",
  formatDateTime: (date: Date, options: DateBucketFormatOptions) => string
): string {
  const date = parseDateBucketKey(key, bucket)
  if (!date) return key
  return formatDateTime(date, bucket === "year" ? { year: "numeric" } : { year: "numeric", month: "long" })
}

/** The only unit that needs a translated word appended after the number
 * today — reserved as its own type (rather than a bare string) so adding
 * a future one (e.g. once a real salary field exists, post-RBAC) is a
 * type-checked, one-line addition here and in Reports.fields.unitSuffix,
 * never a silent runtime fallback. */
export type DisplayUnitSuffix = "age"

export interface AnalyticsValueFormatters {
  formatDuration: DurationFormatter
  formatNumber: NumberFormatter
  /** Looks up the translated unit word for a displayUnit that needs one
   * appended after the number — Reports.fields.unitSuffix.<unit>, e.g.
   * "yaş" for "age". */
  translateUnitSuffix: (unit: DisplayUnitSuffix) => string
}

/**
 * Formats one computed AnalyticsPoint value for display. "count" is
 * always a whole number of rows, regardless of which field (if any) a
 * grouped spec's groupBy points at — e.g. "how many employees per
 * department" is a count, not a measurement of the department field
 * itself. Every other aggregation looks at `valueField`'s own registry
 * `displayUnit` (field-registry.ts): "durationMonths" renders as "X il Y
 * ay" however it was aggregated (avg/min/max of total months is still a
 * total-months number); "age" renders as a locale-formatted number plus
 * the translated "age" word; anything else falls back to the universal
 * locale-aware plain-number rule. Never branches on which data source
 * `valueField` belongs to — a future field just sets `displayUnit` and
 * gets the same treatment for free.
 */
export function formatAnalyticsValue(value: number, spec: Pick<AnalyticsSpec, "aggregation" | "valueField">, formatters: AnalyticsValueFormatters): string {
  if (spec.aggregation === "count") return formatters.formatNumber(value, { maximumFractionDigits: 0 })
  const fieldDef = spec.valueField ? getReportFieldDefinition(spec.valueField) : undefined
  if (fieldDef?.displayUnit === "durationMonths") return formatters.formatDuration(value)
  const formatted = formatters.formatNumber(value, { maximumFractionDigits: 2 })
  if (fieldDef?.displayUnit === "age") return `${formatted} ${formatters.translateUnitSuffix("age")}`
  return formatted
}

/**
 * Builds the full AnalyticsValueFormatters bundle from the two primitives
 * every call site already has — next-intl's own `tFields`/`format.number`
 * (works identically from `useTranslations("Reports.fields")` +
 * `useFormatter()` on the client, or `getTranslations(...)` +
 * `getFormatter(...)` on the server) — so every KPI card, chart, pivot
 * cell, and Excel row builds its formatters the exact same one-line way.
 */
export function buildAnalyticsValueFormatters(
  tFields: (key: string, params?: Record<string, string | number | Date>) => string,
  formatNumber: NumberFormatter
): AnalyticsValueFormatters {
  return {
    formatDuration: buildDurationFormatter(tFields),
    formatNumber,
    translateUnitSuffix: (unit) => tFields(`unitSuffix.${unit}`),
  }
}

export interface PointKeyTranslators {
  /** next-intl's root translator (`useTranslations()` with no namespace,
   * or `getTranslations({locale})`) — same deferred-translation precedent
   * every enum field already uses. */
  translateMessagePath: (messagePath: string) => string
  otherLabel: string
  formatDateTime: (date: Date, options: DateBucketFormatOptions) => string
}

/**
 * The single place an AnalyticsPoint's raw `key` becomes human text —
 * shared by the chart display, the grouped-stats table, and the Excel
 * Summary sheet, so a date/enum/"__other__" key is never translated three
 * slightly-different ways. Reads only `groupBy`'s own bucket/field, never
 * a data source.
 */
export function translateAnalyticsPointKey(
  key: string,
  groupBy: { field: string; bucket: GroupByBucket } | undefined,
  translators: PointKeyTranslators
): string {
  if (key === "__other__") return translators.otherLabel
  if (groupBy?.bucket === "month" || groupBy?.bucket === "year") {
    return formatDateBucketKey(key, groupBy.bucket, translators.formatDateTime)
  }
  const fieldDef = groupBy ? getReportFieldDefinition(groupBy.field) : undefined
  if (fieldDef?.type === "enum") {
    const messagePath = getEnumMessagePath(fieldDef, key)
    if (messagePath) return translators.translateMessagePath(messagePath)
  }
  return key
}
