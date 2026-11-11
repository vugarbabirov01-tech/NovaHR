import { describe, expect, it } from "vitest"

import {
  buildAnalyticsValueFormatters,
  buildDurationFormatter,
  formatAnalyticsValue,
  formatDateBucketKey,
  parseDateBucketKey,
  translateAnalyticsPointKey,
  type NumberFormatter,
  type PointKeyTranslators,
} from "@/lib/reports/analytics-format"

const fakeDurationT = (key: string, params?: Record<string, unknown>) => {
  if (key === "tenureDurationFormat") return `${params!.years} il ${params!.months} ay`
  if (key === "unitSuffix.age") return "yaş"
  return key
}

// Real Intl.NumberFormat (en-US: period decimal, comma thousands) — this
// is exactly what next-intl's own `format.number` wraps, so testing
// against it directly exercises the real formatting rules, not a
// hand-rolled stand-in.
const fakeFormatNumber: NumberFormatter = (value, options) => new Intl.NumberFormat("en-US", options).format(value)

describe("buildDurationFormatter", () => {
  it("splits total months into years + remainder months", () => {
    const format = buildDurationFormatter(fakeDurationT)
    expect(format(73)).toBe("6 il 1 ay")
  })

  it("rounds a fractional average to the nearest whole month before splitting", () => {
    const format = buildDurationFormatter(fakeDurationT)
    // This is the exact real-DB figure from the bug report: avg
    // tenureDurationMonths = 73.0796..., which must read as "6 il 1 ay",
    // never the raw "73".
    expect(format(73.0796812749004)).toBe("6 il 1 ay")
  })

  it("handles an exact multiple of 12 with zero remainder months", () => {
    const format = buildDurationFormatter(fakeDurationT)
    expect(format(24)).toBe("2 il 0 ay")
  })
})

describe("formatAnalyticsValue", () => {
  const formatters = buildAnalyticsValueFormatters(fakeDurationT, fakeFormatNumber)

  it("count is always a plain whole number, regardless of valueField", () => {
    expect(formatAnalyticsValue(12.7, { aggregation: "count" }, formatters)).toBe("13")
  })

  it("count uses a thousands separator for a large row count", () => {
    expect(formatAnalyticsValue(1250, { aggregation: "count" }, formatters)).toBe("1,250")
  })

  it("a duration-flagged field (tenureDurationMonths) formats as years+months for avg/min/max alike", () => {
    for (const aggregation of ["avg", "min", "max"] as const) {
      const result = formatAnalyticsValue(73.0796812749004, { aggregation, valueField: "tenureDurationMonths" }, formatters)
      expect(result).toBe("6 il 1 ay")
    }
  })

  it("an age-flagged field appends the translated unit word after a locale-formatted number (2026-11-11 fix)", () => {
    expect(formatAnalyticsValue(34.6666, { aggregation: "avg", valueField: "age" }, formatters)).toBe("34.67 yaş")
  })

  it("a plain numeric field with no displayUnit keeps decimal precision, no unit word, locale-formatted", () => {
    // tenureYearsDecimal has no displayUnit (it's superseded by
    // tenureDurationMonths for picking, but still a plain field).
    expect(formatAnalyticsValue(10.9166666, { aggregation: "avg", valueField: "tenureYearsDecimal" }, formatters)).toBe("10.92")
  })

  it("drops trailing zeros for a whole result", () => {
    expect(formatAnalyticsValue(34, { aggregation: "avg", valueField: "age" }, formatters)).toBe("34 yaş")
  })

  it("rounds away floating-point noise without losing a real fraction", () => {
    expect(formatAnalyticsValue(0.1 + 0.2, { aggregation: "sum", valueField: "tenureYearsDecimal" }, formatters)).toBe("0.3")
  })

  it("an unknown/absent valueField falls back to the plain locale-number rule, never throws", () => {
    expect(formatAnalyticsValue(5, { aggregation: "sum", valueField: undefined }, formatters)).toBe("5")
  })
})

describe("parseDateBucketKey", () => {
  it("parses a year key", () => {
    const date = parseDateBucketKey("2024", "year")
    expect(date?.getFullYear()).toBe(2024)
  })

  it("parses a YYYY-MM month key", () => {
    const date = parseDateBucketKey("2024-03", "month")
    expect(date?.getFullYear()).toBe(2024)
    expect(date?.getMonth()).toBe(2) // 0-indexed, March
  })

  it("returns null for an unparseable key, never throws", () => {
    expect(parseDateBucketKey("not-a-date", "month")).toBeNull()
    expect(parseDateBucketKey("abc", "year")).toBeNull()
  })
})

describe("formatDateBucketKey", () => {
  const fakeDateTime = (date: Date, options: Intl.DateTimeFormatOptions) =>
    options.month ? `${date.getMonth() + 1}/${date.getFullYear()}` : `${date.getFullYear()}`

  it("formats a month key with month+year", () => {
    expect(formatDateBucketKey("2024-03", "month", fakeDateTime)).toBe("3/2024")
  })

  it("formats a year key with year only", () => {
    expect(formatDateBucketKey("2024", "year", fakeDateTime)).toBe("2024")
  })

  it("falls back to the raw key when unparseable, never throws", () => {
    expect(formatDateBucketKey("garbage", "month", fakeDateTime)).toBe("garbage")
  })
})

describe("translateAnalyticsPointKey", () => {
  const translators: PointKeyTranslators = {
    translateMessagePath: (path) => `[translated:${path}]`,
    otherLabel: "Digər",
    formatDateTime: (date, options) => (options.month ? `${date.getMonth() + 1}/${date.getFullYear()}` : `${date.getFullYear()}`),
  }

  it("translates the reserved __other__ sentinel", () => {
    expect(translateAnalyticsPointKey("__other__", { field: "department", bucket: "category" }, translators)).toBe("Digər")
  })

  it("formats a month/year bucket key via the date formatter", () => {
    expect(translateAnalyticsPointKey("2024-03", { field: "hireDate", bucket: "month" }, translators)).toBe("3/2024")
    expect(translateAnalyticsPointKey("2024", { field: "hireDate", bucket: "year" }, translators)).toBe("2024")
  })

  it("translates an enum field's raw value via its own registry enumNamespace", () => {
    const result = translateAnalyticsPointKey("male", { field: "gender", bucket: "category" }, translators)
    expect(result).toBe("[translated:Gender.male]")
  })

  it("returns a non-enum category key (e.g. a department name) unchanged", () => {
    expect(translateAnalyticsPointKey("IT", { field: "department", bucket: "category" }, translators)).toBe("IT")
  })

  it("returns the raw key unchanged when groupBy is absent (defensive, should not normally happen)", () => {
    expect(translateAnalyticsPointKey("IT", undefined, translators)).toBe("IT")
  })
})
