"use server"

import { revalidatePath } from "next/cache"

import { executeReport } from "@/lib/reports/report-execution-service"
import { buildReportExportFile, type BuiltReportExportFile } from "@/lib/reports/report-export"
import {
  reportDefinitionInputSchema,
  reportPreviewInputSchema,
} from "@/lib/validation/reports"
import {
  createReportDefinition,
  deleteReportDefinition,
  findReportDefinitionById,
  updateReportDefinition,
  type ReportDefinition,
} from "@/repositories/report-definition-repository"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"
import type { ReportPreviewResult } from "@/types/reports"

// No authentication exists yet anywhere in Nova HRMS (see the Leave
// module's own DECIDING_ACTOR for the same, already-documented placeholder).
// This is Report Builder's identical stand-in — ready to become the real
// signed-in user's id the moment auth exists, with zero shape change to
// ReportDefinition.createdBy or any call site below.
const REPORT_ACTOR = "HR"

function revalidateReports() {
  try {
    revalidatePath("/[locale]/reports", "page")
  } catch {
    // Ignored — the write already succeeded regardless of revalidation.
  }
}

export async function previewReportAction(input: unknown): Promise<MasterDataActionResult<ReportPreviewResult>> {
  const parsed = reportPreviewInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const result = await executeReport({
      dataSource: parsed.data.dataSource,
      columns: parsed.data.columns,
      filters: parsed.data.filters,
      sortBy: parsed.data.sortBy ?? null,
      sortDirection: parsed.data.sortDirection ?? "asc",
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    })
    return { success: true, data: result }
  } catch {
    return { success: false, error: "Could not run report." }
  }
}

export async function createReportAction(input: unknown): Promise<MasterDataActionResult<ReportDefinition>> {
  const parsed = reportDefinitionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const report = await createReportDefinition({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      dataSource: parsed.data.dataSource,
      columns: parsed.data.columns,
      filters: parsed.data.filters,
      sortBy: parsed.data.sortBy ?? null,
      sortDirection: parsed.data.sortDirection ?? "asc",
      createdBy: REPORT_ACTOR,
    })
    revalidateReports()
    return { success: true, data: report }
  } catch {
    return { success: false, error: "Could not save report." }
  }
}

export async function updateReportAction(
  id: string,
  input: unknown
): Promise<MasterDataActionResult<ReportDefinition>> {
  const parsed = reportDefinitionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const existing = await findReportDefinitionById(id)
    if (!existing) return { success: false, error: "Report not found." }

    const report = await updateReportDefinition(id, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      dataSource: parsed.data.dataSource,
      columns: parsed.data.columns,
      filters: parsed.data.filters,
      sortBy: parsed.data.sortBy ?? null,
      sortDirection: parsed.data.sortDirection ?? "asc",
      createdBy: existing.createdBy,
    })
    revalidateReports()
    return { success: true, data: report }
  } catch {
    return { success: false, error: "Could not update report." }
  }
}

export async function deleteReportAction(id: string): Promise<MasterDataActionResult<null>> {
  if (!id) return { success: false, error: "Invalid id." }
  try {
    await deleteReportDefinition(id)
    revalidateReports()
    return { success: true, data: null }
  } catch {
    return { success: false, error: "Could not delete report." }
  }
}

export async function exportReportAction(
  input: unknown,
  locale: string,
  reportName: string
): Promise<MasterDataActionResult<BuiltReportExportFile>> {
  const parsed = reportPreviewInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  try {
    const { rows } = await executeReport({
      dataSource: parsed.data.dataSource,
      columns: parsed.data.columns,
      filters: parsed.data.filters,
      sortBy: parsed.data.sortBy ?? null,
      sortDirection: parsed.data.sortDirection ?? "asc",
    })
    const file = await buildReportExportFile(rows, parsed.data.columns, locale, reportName)
    return { success: true, data: file }
  } catch {
    return { success: false, error: "Could not export report." }
  }
}
