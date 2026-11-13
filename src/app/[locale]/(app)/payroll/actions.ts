"use server"

import { DEFAULT_TENANT_ID } from "@/lib/payroll/constants"
import { buildPayrollExportFile, type BuiltPayrollExportFile } from "@/lib/payroll/payroll-export"
import { buildPayrollRows } from "@/lib/payroll/payroll-rows"
import {
  addPayrollAdjustment,
  deletePayrollAdjustment,
  PayrollWorkflowError,
  transitionPayrollPeriod,
} from "@/lib/payroll/payroll-workflow-service"
import type { PayrollPeriodStatus } from "@/types/payroll"
import { findPayrollEmployeeRecords, findPayrollPeriod } from "@/repositories/payroll-repository"
import { findAllEmployees } from "@/repositories/employee-repository"

export type PayrollMutationResult = { success: true } | { success: false; code: string }

async function runMutation(fn: () => Promise<void>): Promise<PayrollMutationResult> {
  try {
    await fn()
    return { success: true }
  } catch (error) {
    if (error instanceof PayrollWorkflowError) return { success: false, code: error.code }
    return { success: false, code: "unknown" }
  }
}

const STATUSES: PayrollPeriodStatus[] = ["DRAFT", "CALCULATED", "APPROVED", "PAID", "CLOSED"]

/** Moves a period to the given status (one step forward, or back before payment). */
export async function transitionPeriodAction(periodId: string, to: string): Promise<PayrollMutationResult> {
  if (!STATUSES.includes(to as PayrollPeriodStatus)) return { success: false, code: "invalidTransition" }
  return runMutation(() => transitionPayrollPeriod(periodId, to as PayrollPeriodStatus))
}

export async function addAdjustmentAction(
  recordId: string,
  input: { kind: string; category: string; amount: number; note?: string }
): Promise<PayrollMutationResult> {
  return runMutation(() => addPayrollAdjustment(recordId, input))
}

export async function deleteAdjustmentAction(adjustmentId: string): Promise<PayrollMutationResult> {
  return runMutation(() => deletePayrollAdjustment(adjustmentId))
}

export type PayrollExportResult =
  | { success: true; data: BuiltPayrollExportFile }
  | { success: false; error: string }

/**
 * Exports one period to Excel. Read-only: unlike the payroll page it never
 * creates a period or records. `employeeIds` limits the export to the rows
 * currently shown (the page's filters); omit it for the whole period.
 */
export async function exportPayrollAction(
  year: number,
  month: number,
  locale: string,
  employeeIds?: string[]
): Promise<PayrollExportResult> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return { success: false, error: "Invalid period." }
  }
  try {
    const period = await findPayrollPeriod(DEFAULT_TENANT_ID, year, month)
    if (!period) return { success: false, error: "Period not found." }
    const [records, employees] = await Promise.all([findPayrollEmployeeRecords(period.id), findAllEmployees()])
    const allowed = employeeIds && employeeIds.length > 0 ? new Set(employeeIds) : null
    const rows = buildPayrollRows(
      allowed ? records.filter((record) => allowed.has(record.employeeId)) : records,
      employees
    )
    return { success: true, data: await buildPayrollExportFile(rows, year, month, locale) }
  } catch {
    return { success: false, error: "Could not export payroll." }
  }
}
