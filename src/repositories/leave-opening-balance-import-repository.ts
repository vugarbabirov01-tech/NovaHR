import { prisma } from "@/lib/prisma"
import type { LeaveOpeningBalanceImportModel } from "@/generated/prisma/models"

export type { LeaveOpeningBalanceImportModel as LeaveOpeningBalanceImport }

/**
 * The migration-batch entity — write-once metadata about an import session.
 * No update function: once an import batch is recorded, it's a historical
 * fact, same reasoning as the ledger itself being append-only. The
 * individual balances it produced live as LeaveLedgerEntry rows with
 * referenceType=IMPORT, referenceId=this record's id (written by whatever
 * calls this repository, not by this file).
 */
export interface LeaveOpeningBalanceImportInput {
  importedBy: string
  sourceSystem?: string | null
  effectiveDate: Date
  note?: string | null
}

export function findAllLeaveOpeningBalanceImports(): Promise<LeaveOpeningBalanceImportModel[]> {
  return prisma.leaveOpeningBalanceImport.findMany({ orderBy: { importedAt: "desc" } })
}

export function findLeaveOpeningBalanceImportById(
  id: string
): Promise<LeaveOpeningBalanceImportModel | null> {
  return prisma.leaveOpeningBalanceImport.findUnique({ where: { id } })
}

export function createLeaveOpeningBalanceImport(
  input: LeaveOpeningBalanceImportInput
): Promise<LeaveOpeningBalanceImportModel> {
  return prisma.leaveOpeningBalanceImport.create({
    data: {
      importedBy: input.importedBy,
      sourceSystem: input.sourceSystem ?? null,
      effectiveDate: input.effectiveDate,
      note: input.note ?? null,
    },
  })
}
