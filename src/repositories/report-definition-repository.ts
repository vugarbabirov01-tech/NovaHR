import { Prisma } from "@/generated/prisma/client"
import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { AnalyticsSpec, ReportColumn, ReportFilter, ReportDataSourceKey } from "@/types/reports"

/** Prisma's Json input type has no direct "null" member — an explicit null
 * must be spelled Prisma.NullableJsonNullValueInput.JsonNull (same
 * precedent as approval-workflow-definition-repository.ts's own
 * toJsonInput, for the same reason: this is a nullable Json column, not a
 * required one). */
function toNullableJsonInput(value: AnalyticsSpec | null | undefined) {
  if (!value) return Prisma.NullableJsonNullValueInput.JsonNull
  return value as unknown as object
}

export interface ReportDefinition {
  id: string
  name: string
  description: string | null
  dataSource: ReportDataSourceKey
  columns: ReportColumn[]
  filters: ReportFilter[]
  sortBy: string | null
  sortDirection: "asc" | "desc"
  /** [] for every report saved before this field existed (column is
   * nullable; null is normalized to [] here, see the schema's own
   * comment). */
  kpis: AnalyticsSpec[]
  chartConfig: AnalyticsSpec | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface ReportDefinitionInput {
  name: string
  description?: string | null
  dataSource: ReportDataSourceKey
  columns: ReportColumn[]
  filters: ReportFilter[]
  sortBy?: string | null
  sortDirection?: "asc" | "desc"
  kpis?: AnalyticsSpec[]
  chartConfig?: AnalyticsSpec | null
  createdBy: string
}

function toReportDefinition(row: {
  id: string
  name: string
  description: string | null
  dataSource: string
  columns: unknown
  filters: unknown
  sortBy: string | null
  sortDirection: string
  kpis: unknown
  chartConfig: unknown
  createdBy: string
  createdAt: Date
  updatedAt: Date
}): ReportDefinition {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    dataSource: row.dataSource as ReportDataSourceKey,
    columns: row.columns as ReportColumn[],
    filters: row.filters as ReportFilter[],
    sortBy: row.sortBy,
    sortDirection: row.sortDirection as "asc" | "desc",
    kpis: (row.kpis as AnalyticsSpec[] | null) ?? [],
    chartConfig: (row.chartConfig as AnalyticsSpec | null) ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function findAllReportDefinitions(
  client: PrismaClientOrTransaction = prisma
): Promise<ReportDefinition[]> {
  return client.reportDefinition
    .findMany({ orderBy: { updatedAt: "desc" } })
    .then((rows) => rows.map(toReportDefinition))
}

export async function findReportDefinitionById(
  id: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ReportDefinition | null> {
  const row = await client.reportDefinition.findUnique({ where: { id } })
  return row ? toReportDefinition(row) : null
}

export async function createReportDefinition(
  input: ReportDefinitionInput,
  client: PrismaClientOrTransaction = prisma
): Promise<ReportDefinition> {
  const row = await client.reportDefinition.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      dataSource: input.dataSource,
      columns: input.columns as unknown as object,
      filters: input.filters as unknown as object,
      sortBy: input.sortBy ?? null,
      sortDirection: input.sortDirection ?? "asc",
      kpis: (input.kpis ?? []) as unknown as object,
      chartConfig: toNullableJsonInput(input.chartConfig),
      createdBy: input.createdBy,
    },
  })
  return toReportDefinition(row)
}

export async function updateReportDefinition(
  id: string,
  input: ReportDefinitionInput,
  client: PrismaClientOrTransaction = prisma
): Promise<ReportDefinition> {
  const row = await client.reportDefinition.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description ?? null,
      dataSource: input.dataSource,
      columns: input.columns as unknown as object,
      filters: input.filters as unknown as object,
      sortBy: input.sortBy ?? null,
      sortDirection: input.sortDirection ?? "asc",
      kpis: (input.kpis ?? []) as unknown as object,
      chartConfig: toNullableJsonInput(input.chartConfig),
    },
  })
  return toReportDefinition(row)
}

export async function deleteReportDefinition(
  id: string,
  client: PrismaClientOrTransaction = prisma
): Promise<void> {
  await client.reportDefinition.delete({ where: { id } })
}
