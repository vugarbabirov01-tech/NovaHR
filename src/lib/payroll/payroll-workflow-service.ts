import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import {
  findAdjustmentsByRecordIds,
  findPayrollPeriodById,
  findPayrollRecordById,
} from "@/repositories/payroll-repository"
import { computeGrossAmount, computeNetAmount } from "@/lib/payroll/payroll-calculations"
import { sumAdjustments, validateAdjustment, type AdjustmentInput } from "@/lib/payroll/payroll-adjustments"
import { canTransition, isPeriodEditable } from "@/lib/payroll/payroll-workflow"
import type { PayrollPeriodStatus } from "@/types/payroll"

export type WorkflowErrorCode =
  | "notFound"
  | "invalidTransition"
  | "locked"
  | "invalidKind"
  | "invalidCategory"
  | "invalidAmount"
  | "invalidNote"

export class PayrollWorkflowError extends Error {
  constructor(public readonly code: WorkflowErrorCode) {
    super(code)
  }
}

/** Re-derives one record's additions/deductions/gross/net from its adjustment rows. */
async function recomputeRecord(recordId: string, client: PrismaClientOrTransaction): Promise<void> {
  const record = await findPayrollRecordById(recordId, client)
  if (!record) throw new PayrollWorkflowError("notFound")
  const adjustments = await findAdjustmentsByRecordIds([recordId], client)
  const { additions, deductions } = sumAdjustments(adjustments)
  const grossAmount = computeGrossAmount(record.baseSalary, additions)
  await client.payrollEmployeeRecord.update({
    where: { id: recordId },
    data: { additions, deductions, grossAmount, netAmount: computeNetAmount(grossAmount, deductions) },
  })
}

/** Moves a period one step (forward, or back before payment). Records follow the period's status. */
export async function transitionPayrollPeriod(
  periodId: string,
  to: PayrollPeriodStatus,
  actor = "system"
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const period = await findPayrollPeriodById(periodId, tx)
    if (!period) throw new PayrollWorkflowError("notFound")
    const from = period.status as PayrollPeriodStatus
    if (!canTransition(from, to)) throw new PayrollWorkflowError("invalidTransition")

    // "Calculate" refreshes every line from its adjustments.
    if (to === "CALCULATED") {
      const records = await tx.payrollEmployeeRecord.findMany({ where: { payrollPeriodId: periodId } })
      for (const record of records) await recomputeRecord(record.id, tx)
    }

    await tx.payrollPeriod.update({ where: { id: periodId }, data: { status: to } })
    await tx.payrollEmployeeRecord.updateMany({ where: { payrollPeriodId: periodId }, data: { status: to } })
    await tx.payrollPeriodEvent.create({
      data: { payrollPeriodId: periodId, fromStatus: from, toStatus: to, actor },
    })
  })
}

async function assertRecordEditable(recordId: string, client: PrismaClientOrTransaction) {
  const record = await findPayrollRecordById(recordId, client)
  if (!record) throw new PayrollWorkflowError("notFound")
  const period = await findPayrollPeriodById(record.payrollPeriodId, client)
  if (!period) throw new PayrollWorkflowError("notFound")
  if (!isPeriodEditable(period.status as PayrollPeriodStatus)) throw new PayrollWorkflowError("locked")
  return record
}

export async function addPayrollAdjustment(recordId: string, input: AdjustmentInput): Promise<void> {
  const invalid = validateAdjustment(input)
  if (invalid) {
    const codes = {
      kind: "invalidKind",
      category: "invalidCategory",
      amount: "invalidAmount",
      note: "invalidNote",
    } as const
    throw new PayrollWorkflowError(codes[invalid])
  }
  await prisma.$transaction(async (tx) => {
    await assertRecordEditable(recordId, tx)
    await tx.payrollAdjustment.create({
      data: {
        recordId,
        kind: input.kind,
        category: input.category,
        amount: Math.round(input.amount * 100) / 100,
        note: (input.note ?? "").trim(),
      },
    })
    await recomputeRecord(recordId, tx)
  })
}

export async function deletePayrollAdjustment(adjustmentId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const adjustment = await tx.payrollAdjustment.findUnique({ where: { id: adjustmentId } })
    if (!adjustment) throw new PayrollWorkflowError("notFound")
    await assertRecordEditable(adjustment.recordId, tx)
    await tx.payrollAdjustment.delete({ where: { id: adjustmentId } })
    await recomputeRecord(adjustment.recordId, tx)
  })
}
