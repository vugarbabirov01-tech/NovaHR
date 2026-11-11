import type {
  AnalyticsPoint,
  AnalyticsResult,
  AnalyticsSpec,
  PivotCell,
  PivotDimension,
  PivotResult,
  PivotSpec,
  ReportRow,
} from "@/types/reports"

// Universal analytics engine — the one place both KPI cards and the chart
// panel call (1D), and (2026-11-11, Phase C) the pivot cross-tab calls
// (2D). Deliberately reads nothing but the spec and the rows: no
// `dataSource` parameter exists anywhere in this file, and no function
// here branches on it. A brand-new data source needs zero changes in this
// file — only its own field-registry entries (type + `aggregations` +
// `groupable`, see field-registry.ts) have to exist for that source's
// fields to work with every function below. lib/validation/reports.ts is
// what enforces that a spec's fields actually belong to the declared data
// source and are allowed the aggregation/grouping requested — this file
// trusts its input the same way filter-engine.ts does, and is pure/
// synchronous for the same reason (unit-testable with plain arrays, no DB).

const MAX_CATEGORY_BUCKETS = 15
const OTHER_BUCKET_KEY = "__other__"
const DEFAULT_INTERVAL_BUCKET_COUNT = 8
const MIN_INTERVAL_BUCKET_COUNT = 2
const MAX_INTERVAL_BUCKET_COUNT = 20
const PIVOT_CELL_KEY_SEPARATOR = "\u0000"

function toNumber(value: ReportRow[string] | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isNaN(n) ? null : n
}

/**
 * Aggregating zero values (e.g. every row in a bucket has a null
 * valueField) returns 0 — the same "fail open with a plain default"
 * convention filter-engine.ts already uses for missing values, rather than
 * null/NaN propagating into a chart, KPI card, or pivot cell.
 */
function aggregate(values: number[], aggregation: AnalyticsAggregationLike): number {
  if (aggregation === "count") return values.length
  if (values.length === 0) return 0
  switch (aggregation) {
    case "sum":
      return values.reduce((a, b) => a + b, 0)
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length
    case "min":
      return Math.min(...values)
    case "max":
      return Math.max(...values)
    default:
      return values.length
  }
}

type AnalyticsAggregationLike = AnalyticsSpec["aggregation"]

/** Shared by AnalyticsSpec (1D) and PivotSpec (2D) — both have the same
 * `aggregation`/`valueField` shape, so one function serves either. */
function valuesFor(rows: ReportRow[], spec: { aggregation: AnalyticsAggregationLike; valueField?: string }): number[] {
  if (spec.aggregation === "count") return rows.map(() => 1)
  const field = spec.valueField!
  return rows.map((row) => toNumber(row[field])).filter((v): v is number => v !== null)
}

function aggregateRows(rows: ReportRow[], spec: { aggregation: AnalyticsAggregationLike; valueField?: string }): number {
  return spec.aggregation === "count" ? rows.length : aggregate(valuesFor(rows, spec), spec.aggregation)
}

function computeScalar(rows: ReportRow[], spec: AnalyticsSpec): AnalyticsResult {
  return { spec, points: [{ key: "total", value: aggregateRows(rows, spec) }], cappedOther: false }
}

function categoryKey(row: ReportRow, field: string): string | null {
  const raw = row[field]
  if (raw === null || raw === undefined || raw === "") return null
  return String(raw)
}

function dateKey(row: ReportRow, field: string, granularity: "month" | "year"): string | null {
  const raw = row[field]
  if (!raw) return null
  const date = new Date(String(raw))
  if (Number.isNaN(date.getTime())) return null
  const year = String(date.getFullYear())
  if (granularity === "year") return year
  return `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/**
 * For an all-integer field (age, a headcount, ...): the bucket count is
 * clamped to the number of distinct integer slots in [min,max] and the
 * width is rounded UP to a whole number — this is what guarantees every
 * bucket boundary is itself a whole number, so two adjacent buckets can
 * never round to the identical display label (the 2026-11-11 bug: with a
 * fractional width, e.g. 0.625, Math.round() on two different boundaries
 * like 20.125 and 20.25 both collapse to "20", making consecutive buckets
 * show the same text even though each row still landed in exactly one of
 * them). Requesting more buckets than there are integer slots now simply
 * yields fewer, single-value buckets instead of duplicate/empty ones.
 */
function integerBucketing(min: number, max: number, requestedBucketCount: number): { bucketCount: number; width: number } {
  const distinctRange = max - min + 1
  const bucketCount = Math.min(requestedBucketCount, distinctRange)
  const width = Math.max(1, Math.ceil(distinctRange / bucketCount))
  return { bucketCount, width }
}

/** How many decimals a label needs so that two boundaries `width` apart
 * never round to the same text — the fractional-field counterpart to
 * integerBucketing's whole-number widths above. */
function decimalPrecisionForWidth(width: number): number {
  if (width <= 0) return 2
  if (width >= 1) return 1
  return Math.min(4, Math.max(2, Math.ceil(-Math.log10(width)) + 1))
}

function formatRangeLabel(lower: number, upper: number, isInteger: boolean, width: number): string {
  if (isInteger) {
    const lo = Math.round(lower)
    const hi = Math.round(upper)
    return lo === hi ? String(lo) : `${lo}–${hi}`
  }
  const precision = decimalPrecisionForWidth(width)
  const lo = lower.toFixed(precision)
  const hi = upper.toFixed(precision)
  return lo === hi ? lo : `${lo}–${hi}`
}

interface KeyResolver {
  getKey: (row: ReportRow) => string | null
  /** Only set for "interval" — the full ordered list of bucket labels in
   * ascending numeric order. "category" is ordered by row count
   * elsewhere; "month"/"year" keys already sort correctly as plain ISO-
   * ish strings, so neither needs this. */
  orderedKeys?: string[]
}

/**
 * THE shared bucket mechanism (2026-11-11 requirement: "1D və 2D
 * qruplaşdırma ortaq bucket mexanizmindən istifadə etsin") — computes,
 * for one dimension (a field + how to bucket it), a reusable function
 * that assigns any row to that dimension's key. Used identically by the
 * 1D category/date/interval paths below AND by computePivot's two
 * dimensions — a pivot's row axis and column axis are each just one more
 * call to this same function, not a separate re-implementation.
 */
function buildKeyResolver(rows: ReportRow[], dimension: PivotDimension): KeyResolver {
  if (dimension.bucket === "month" || dimension.bucket === "year") {
    const bucket = dimension.bucket
    return { getKey: (row) => dateKey(row, dimension.field, bucket) }
  }
  if (dimension.bucket === "category") {
    return { getKey: (row) => categoryKey(row, dimension.field) }
  }

  // interval
  const requestedBucketCount = Math.min(
    MAX_INTERVAL_BUCKET_COUNT,
    Math.max(MIN_INTERVAL_BUCKET_COUNT, dimension.bucketCount ?? DEFAULT_INTERVAL_BUCKET_COUNT)
  )
  const numeric = rows.map((row) => toNumber(row[dimension.field])).filter((x): x is number => x !== null)
  if (numeric.length === 0) return { getKey: () => null, orderedKeys: [] }

  const min = Math.min(...numeric)
  const max = Math.max(...numeric)
  const isInteger = numeric.every((x) => Number.isInteger(x))
  const { bucketCount, width } =
    min === max
      ? { bucketCount: 1, width: 1 }
      : isInteger
        ? integerBucketing(min, max, requestedBucketCount)
        : { bucketCount: requestedBucketCount, width: (max - min) / requestedBucketCount }

  const orderedKeys: string[] = []
  for (let i = 0; i < bucketCount; i++) {
    const lower = min + i * width
    const upper = i === bucketCount - 1 ? max : min + (i + 1) * width - (isInteger ? 1 : 0)
    orderedKeys.push(formatRangeLabel(lower, upper, isInteger, width))
  }

  const field = dimension.field
  return {
    getKey: (row) => {
      const x = toNumber(row[field])
      if (x === null) return null
      const index = width > 0 ? Math.min(bucketCount - 1, Math.floor((x - min) / width)) : 0
      return orderedKeys[index]
    },
    orderedKeys,
  }
}

function pushTo(map: Map<string, ReportRow[]>, key: string, row: ReportRow) {
  const bucket = map.get(key)
  if (bucket) bucket.push(row)
  else map.set(key, [row])
}

/**
 * Caps a category axis at MAX_CATEGORY_BUCKETS, folding the SMALLEST
 * groups (by row count) into the reserved "__other__" key — a raw-key ->
 * final-key remap, returned even when nothing needed capping (an
 * identity map), so every caller (1D category grouping, and both of a
 * pivot's axes) applies the exact same rule the exact same way.
 */
function buildCategoryKeyRemap(groups: Map<string, ReportRow[]>): { remap: Map<string, string>; cappedOther: boolean } {
  const entries = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length)
  const remap = new Map<string, string>()
  if (entries.length <= MAX_CATEGORY_BUCKETS) {
    for (const [key] of entries) remap.set(key, key)
    return { remap, cappedOther: false }
  }
  for (const [key] of entries.slice(0, MAX_CATEGORY_BUCKETS - 1)) remap.set(key, key)
  for (const [key] of entries.slice(MAX_CATEGORY_BUCKETS - 1)) remap.set(key, OTHER_BUCKET_KEY)
  return { remap, cappedOther: true }
}

/** Orders a dimension's final keys for display — category by descending
 * row count (any "__other__" always last, regardless of its own size,
 * since it's an overflow bucket, not a real category); month/year
 * chronologically; interval by ascending numeric range (via the
 * resolver's own orderedKeys, since string-sorting range labels wouldn't
 * always match numeric order, e.g. "100–110" vs "20–30"). */
function orderKeys(groups: Map<string, ReportRow[]>, dimension: PivotDimension, resolver: KeyResolver): string[] {
  if (dimension.bucket === "month" || dimension.bucket === "year") {
    return Array.from(groups.keys()).sort((a, b) => a.localeCompare(b))
  }
  if (dimension.bucket === "interval") {
    return (resolver.orderedKeys ?? []).filter((key) => groups.has(key))
  }
  const withoutOther = Array.from(groups.keys())
    .filter((key) => key !== OTHER_BUCKET_KEY)
    .sort((a, b) => (groups.get(b)?.length ?? 0) - (groups.get(a)?.length ?? 0))
  return groups.has(OTHER_BUCKET_KEY) ? [...withoutOther, OTHER_BUCKET_KEY] : withoutOther
}

/**
 * Adds `percentage` to every point — each point's share of the sum of
 * every point's own value in this same result. Guards the zero-division
 * case (an all-zero or empty breakdown) by reporting 0 for every point
 * rather than NaN/Infinity. "group" currently computes identically to
 * "all" — see AnalyticsGroupBy.percentageBase's own comment for why (the
 * pivot's own distinct row/column percentage lives in computePivot
 * instead — a flat 1-dimensional result has only one grouping level, so
 * there is nothing else for "group" to mean here).
 */
function withPercentages(points: AnalyticsPoint[]): AnalyticsPoint[] {
  const total = points.reduce((sum, point) => sum + point.value, 0)
  return points.map((point) => ({
    ...point,
    percentage: total > 0 ? Math.round((point.value / total) * 10000) / 100 : 0,
  }))
}

/**
 * Bins over the FILTERED set's own [min,max] — recomputed on every call,
 * so the histogram always reflects whatever filters narrowed the data
 * down to, never a fixed scale baked in anywhere. Whether bucketing is
 * integer-aware or continuous is decided purely from the actual filtered
 * values (Number.isInteger), never from a field name or data source.
 */
function computeInterval(rows: ReportRow[], spec: AnalyticsSpec): AnalyticsResult {
  const resolver = buildKeyResolver(rows, spec.groupBy!)
  const groups = new Map<string, ReportRow[]>()
  for (const row of rows) {
    const key = resolver.getKey(row)
    if (key === null) continue
    pushTo(groups, key, row)
  }

  const points: AnalyticsPoint[] = (resolver.orderedKeys ?? [])
    .filter((key) => groups.has(key))
    .map((key) => ({ key, value: aggregateRows(groups.get(key)!, spec) }))

  return { spec, points: withPercentages(points), cappedOther: false }
}

function computeCategoryOrDate(rows: ReportRow[], spec: AnalyticsSpec): AnalyticsResult {
  const groupBy = spec.groupBy!
  const resolver = buildKeyResolver(rows, groupBy)
  const rawGroups = new Map<string, ReportRow[]>()
  for (const row of rows) {
    const key = resolver.getKey(row)
    if (key === null) continue
    pushTo(rawGroups, key, row)
  }

  let groups = rawGroups
  let cappedOther = false
  if (groupBy.bucket === "category") {
    const { remap, cappedOther: capped } = buildCategoryKeyRemap(rawGroups)
    cappedOther = capped
    if (capped) {
      groups = new Map()
      for (const [rawKey, groupRows] of rawGroups) {
        const finalKey = remap.get(rawKey)!
        for (const row of groupRows) pushTo(groups, finalKey, row)
      }
    }
  }

  const keys = orderKeys(groups, groupBy, resolver)
  const points: AnalyticsPoint[] = keys.map((key) => ({ key, value: aggregateRows(groups.get(key)!, spec) }))

  return { spec, points: withPercentages(points), cappedOther }
}

/**
 * The two-dimensional cross-tab (2026-11-11, Phase C). Builds row/column
 * keys via the exact same buildKeyResolver every 1D path uses, caps each
 * axis independently at MAX_CATEGORY_BUCKETS (never affecting the other
 * axis), and — critically — computes row/column/grand totals by
 * aggregating the real underlying rows for that slice directly, never by
 * combining the grid's own cell values. This is what keeps avg/min/max
 * mathematically correct: a row total is the average/min/max of every row
 * with that row key across ALL columns, not an average of that row's own
 * per-column averages (which would silently misweight columns with
 * different row counts).
 */
function computePivot(rows: ReportRow[], spec: PivotSpec): PivotResult {
  const rowResolver = buildKeyResolver(rows, spec.rowDimension)
  const columnResolver = buildKeyResolver(rows, spec.columnDimension)

  const includedRows: ReportRow[] = []
  const rawRowKeyByRow = new Map<ReportRow, string>()
  const rawColumnKeyByRow = new Map<ReportRow, string>()
  const rawRowGroups = new Map<string, ReportRow[]>()
  const rawColumnGroups = new Map<string, ReportRow[]>()

  for (const row of rows) {
    const rowKey = rowResolver.getKey(row)
    const columnKey = columnResolver.getKey(row)
    // A row missing EITHER dimension's value is excluded from the pivot
    // entirely — same convention as 1D category grouping (never a
    // phantom "null" bucket on either axis).
    if (rowKey === null || columnKey === null) continue
    includedRows.push(row)
    rawRowKeyByRow.set(row, rowKey)
    rawColumnKeyByRow.set(row, columnKey)
    pushTo(rawRowGroups, rowKey, row)
    pushTo(rawColumnGroups, columnKey, row)
  }

  const rowRemap =
    spec.rowDimension.bucket === "category"
      ? buildCategoryKeyRemap(rawRowGroups)
      : { remap: new Map(Array.from(rawRowGroups.keys()).map((key) => [key, key])), cappedOther: false }
  const columnRemap =
    spec.columnDimension.bucket === "category"
      ? buildCategoryKeyRemap(rawColumnGroups)
      : { remap: new Map(Array.from(rawColumnGroups.keys()).map((key) => [key, key])), cappedOther: false }

  const rowGroups = new Map<string, ReportRow[]>()
  const columnGroups = new Map<string, ReportRow[]>()
  const cellGroups = new Map<string, ReportRow[]>()
  for (const row of includedRows) {
    const finalRowKey = rowRemap.remap.get(rawRowKeyByRow.get(row)!)!
    const finalColumnKey = columnRemap.remap.get(rawColumnKeyByRow.get(row)!)!
    pushTo(rowGroups, finalRowKey, row)
    pushTo(columnGroups, finalColumnKey, row)
    pushTo(cellGroups, `${finalRowKey}${PIVOT_CELL_KEY_SEPARATOR}${finalColumnKey}`, row)
  }

  const rowKeys = orderKeys(rowGroups, spec.rowDimension, rowResolver)
  const columnKeys = orderKeys(columnGroups, spec.columnDimension, columnResolver)

  const rowTotals: Record<string, number> = {}
  for (const [key, groupRows] of rowGroups) rowTotals[key] = aggregateRows(groupRows, spec)
  const columnTotals: Record<string, number> = {}
  for (const [key, groupRows] of columnGroups) columnTotals[key] = aggregateRows(groupRows, spec)
  const grandTotal = aggregateRows(includedRows, spec)

  // Percentage of a min/max/avg has no sound meaning (a cell's average
  // isn't "part of" the grand average the way a count or sum is) —
  // requirement 3: never fabricate one for those.
  const percentageEligible = spec.aggregation === "count" || spec.aggregation === "sum"
  const percentageBase = spec.percentageBase ?? "all"

  const cells: PivotCell[] = []
  for (const [cellKey, groupRows] of cellGroups) {
    const separatorIndex = cellKey.indexOf(PIVOT_CELL_KEY_SEPARATOR)
    const rowKey = cellKey.slice(0, separatorIndex)
    const columnKey = cellKey.slice(separatorIndex + 1)
    const value = aggregateRows(groupRows, spec)
    let percentage: number | undefined
    if (percentageEligible) {
      const denominator = percentageBase === "row" ? rowTotals[rowKey] : percentageBase === "column" ? columnTotals[columnKey] : grandTotal
      percentage = denominator > 0 ? Math.round((value / denominator) * 10000) / 100 : 0
    }
    cells.push({ rowKey, columnKey, value, percentage })
  }

  return {
    spec,
    rowKeys,
    columnKeys,
    cells,
    rowTotals,
    columnTotals,
    grandTotal,
    cappedOtherRow: rowRemap.cappedOther,
    cappedOtherColumn: columnRemap.cappedOther,
  }
}

/** Looks up one cell's value/percentage, distinguishing "no matching
 * rows at all" (returns undefined) from "matched rows that aggregated to
 * a real 0" (returns a PivotCell with value 0) — requirement 4. A
 * convenience for renderers; aggregation-engine.ts's own PivotResult.cells
 * is already sparse, this just saves every caller re-deriving the
 * same (rowKey, columnKey) lookup key. */
export function findPivotCell(result: PivotResult, rowKey: string, columnKey: string): PivotCell | undefined {
  return result.cells.find((cell) => cell.rowKey === rowKey && cell.columnKey === columnKey)
}

/**
 * The single entry point for 1D specs: no `groupBy` is a KPI (one point,
 * key "total"); a spec with `groupBy` is a chart series. See this file's
 * own header comment for why there is no data-source parameter.
 */
export function computeAnalytics(rows: ReportRow[], spec: AnalyticsSpec): AnalyticsResult {
  if (!spec.groupBy) return computeScalar(rows, spec)
  if (spec.groupBy.bucket === "interval") return computeInterval(rows, spec)
  return computeCategoryOrDate(rows, spec)
}

/** The entry point for 2D pivot specs — see computePivot's own comment. */
export function computePivotAnalytics(rows: ReportRow[], spec: PivotSpec): PivotResult {
  return computePivot(rows, spec)
}
