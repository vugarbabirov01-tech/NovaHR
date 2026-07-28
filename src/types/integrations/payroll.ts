// Payroll settlement figures Termination displays but never computes.

export type PayrollSettlementItemKey =
  | "baseSalary"
  | "bonuses"
  | "allowances"
  | "unusedLeaveCompensation"
  | "deductions"
  | "outstandingAssetDeductions"
  | "estimatedFinalPayment"

export interface PayrollSettlementItem {
  key: PayrollSettlementItemKey
  amount: number | null // null = not calculable without Payroll module integration
  currency: string
}

export interface PayrollSettlementContext {
  unusedLeaveDays: number
  outstandingAssetCount: number
}

export interface PayrollProvider {
  getFinalSettlementSummary(
    employeeId: string,
    context: PayrollSettlementContext
  ): Promise<PayrollSettlementItem[]>
}
