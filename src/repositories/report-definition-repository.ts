import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { ReportColumn, ReportFilter, ReportDataSourceKey } from "@/types/reports"

export interface ReportDefinition {
  id: string
  name: string
  description: string | null
  dataSource: ReportDataSourceKey
  columns: ReportColumn[]
  filters: ReportFilter[]
  sortBy: string | null
  sortDirection: "asc" | "desc"
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
