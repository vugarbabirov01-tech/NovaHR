"use server"

import { employeeDirectory } from "@/data/employee-directory"
import { profileToExportRow } from "@/lib/employee-export/profile-to-export-row"
import { buildExportFile, type BuiltExportFile } from "@/lib/employee-export/build-export-file"
import type { ExportFormat, ExportType } from "@/lib/employee-export/types"

/**
 * Runs entirely server-side — the data already lives in employeeDirectory,
 * so there's no file to parse and nothing to keep off a browser UI thread.
 * Building the workbook for even 10,000+ rows here never blocks the
 * client; the only client-side work is decoding the returned base64 into a
 * download, which is negligible regardless of row count.
 */
export async function exportEmployeesAction(
  ids: string[],
  format: ExportFormat,
  exportType: ExportType
): Promise<BuiltExportFile> {
  const idSet = new Set(ids)
  const profiles = employeeDirectory.filter((employee) => idSet.has(employee.id))
  const rows = profiles.map((profile) => profileToExportRow(profile, exportType))
  return buildExportFile(rows, format, exportType)
}
