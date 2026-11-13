import type { PayrollPeriodStatus } from "@/types/payroll"

/**
 * Period status workflow. Forward one step at a time; a step back is allowed
 * only before payment (APPROVED -> CALCULATED -> DRAFT). PAID can only move on
 * to CLOSED and CLOSED is final.
 */
const FORWARD: Partial<Record<PayrollPeriodStatus, PayrollPeriodStatus>> = {
  DRAFT: "CALCULATED",
  CALCULATED: "APPROVED",
  APPROVED: "PAID",
  PAID: "CLOSED",
}

const BACKWARD: Partial<Record<PayrollPeriodStatus, PayrollPeriodStatus>> = {
  CALCULATED: "DRAFT",
  APPROVED: "CALCULATED",
}

export function nextStatus(status: PayrollPeriodStatus): PayrollPeriodStatus | null {
  return FORWARD[status] ?? null
}

export function previousStatus(status: PayrollPeriodStatus): PayrollPeriodStatus | null {
  return BACKWARD[status] ?? null
}

export function canTransition(from: PayrollPeriodStatus, to: PayrollPeriodStatus): boolean {
  return FORWARD[from] === to || BACKWARD[from] === to
}

/** Additions/deductions and the employee list are editable only before approval. */
export function isPeriodEditable(status: PayrollPeriodStatus): boolean {
  return status === "DRAFT" || status === "CALCULATED"
}
