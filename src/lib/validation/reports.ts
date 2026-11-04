import { z } from "zod"

import {
  ALL_DATA_SOURCE_KEYS,
  OPERATORS_BY_FIELD_TYPE,
  isDataSourceAvailable,
  type FilterOperator,
  type ReportDataSourceKey,
} from "@/types/reports"
import { getReportFieldDefinition } from "@/lib/reports/field-registry"

// Shared validation for the Report Builder's Server Actions. Every field
// key and operator is checked against the field registry here — a
// request naming an unknown field, an operator that field's own type
// doesn't support (e.g. "contains" on a date), or a field that belongs to
// a DIFFERENT data source than the one the request declares, is rejected
// before it ever reaches the filter engine. This is also the one place
// that keeps the Report Builder from ever becoming "pass the user's own
// query to the database": the only things a request can express are a
// whitelisted field (of the right data source), a whitelisted operator
// for that field's type, and a plain value.

const DATA_SOURCE_KEYS = ALL_DATA_SOURCE_KEYS as [ReportDataSourceKey, ...ReportDataSourceKey[]]

const ALL_OPERATORS = Array.from(new Set(Object.values(OPERATORS_BY_FIELD_TYPE).flat())) as [
  FilterOperator,
  ...FilterOperator[],
]

export const reportFilterSchema = z
  .object({
    field: z.string().min(1),
    operator: z.enum(ALL_OPERATORS),
    value: z.union([z.string(), z.number()]).nullable().optional(),
    valueTo: z.union([z.string(), z.number()]).nullable().optional(),
  })
  .refine(
    (filter) => {
      const definition = getReportFieldDefinition(filter.field)
      if (!definition) return false
      return OPERATORS_BY_FIELD_TYPE[definition.type].includes(filter.operator as never)
    },
    { message: "Unknown field, or operator not supported for this field's type." }
  )

function isKnownColumn(key: string): boolean {
  return getReportFieldDefinition(key) !== undefined
}

const knownSortBySchema = z
  .string()
  .min(1)
  .refine(isKnownColumn, { message: "Unknown column." })
  .nullable()
  .optional()

const dataSourceSchema = z
  .enum(DATA_SOURCE_KEYS)
  .refine((value) => isDataSourceAvailable(value), { message: "Data source not available." })

/**
 * Every column, every filter's field, and sortBy must belong to the SAME
 * data source the request itself declares — this is what stops a request
 * from mixing fields across sources (e.g. dataSource: "EMPLOYEES" with a
 * "leaveStatus" column) even though "leaveStatus" is itself a real,
 * known key elsewhere in the registry.
 */
function belongsToDataSource(dataSource: string, key: string): boolean {
  return getReportFieldDefinition(key)?.dataSource === dataSource
}

const crossFieldDataSourceCheck = <
  T extends { dataSource: string; columns: string[]; filters: { field: string }[]; sortBy?: string | null },
>(
  input: T
) =>
  input.columns.every((key) => belongsToDataSource(input.dataSource, key)) &&
  input.filters.every((filter) => belongsToDataSource(input.dataSource, filter.field)) &&
  (!input.sortBy || belongsToDataSource(input.dataSource, input.sortBy))

export const reportDefinitionInputSchema = z
  .object({
    name: z.string().trim().min(1, "This field is required.").max(120),
    description: z.string().trim().max(500).optional().nullable(),
    dataSource: dataSourceSchema,
    columns: z
      .array(z.string().min(1))
      .min(1, "Select at least one column.")
      .refine((columns) => columns.every(isKnownColumn), { message: "Unknown column." }),
    filters: z.array(reportFilterSchema),
    sortBy: knownSortBySchema,
    sortDirection: z.enum(["asc", "desc"]).optional(),
  })
  .refine(crossFieldDataSourceCheck, { message: "Column, filter, or sort field does not belong to this data source." })

export const reportPreviewInputSchema = z
  .object({
    dataSource: dataSourceSchema,
    columns: z.array(z.string().min(1)).refine((columns) => columns.every(isKnownColumn), {
      message: "Unknown column.",
    }),
    filters: z.array(reportFilterSchema),
    sortBy: knownSortBySchema,
    sortDirection: z.enum(["asc", "desc"]).optional(),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().max(200).optional(),
  })
  .refine(crossFieldDataSourceCheck, { message: "Column, filter, or sort field does not belong to this data source." })
