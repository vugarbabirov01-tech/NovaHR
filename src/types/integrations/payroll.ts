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

/**
 * Leave Request wizard's Review step — same "real figures now, null until
 * Payroll can calculate the rest" contract as PayrollSettlementItem above.
 * averageMonthlySalary/averageDailySalary/grossAmount are estimable today
 * from the employee's own payroll record; incomeTax/socialSecurityFund
 * (DSMF)/unemploymentInsurance/medicalInsurance/netAmount all require the
 * real Payroll engine's statutory calculations and stay null (rendered as a
 * "will be calculated" note) until that integration exists.
 */
export interface LeavePaymentSummary {
  averageMonthlySalary: number | null
  averageDailySalary: number | null
  leaveDays: number
  grossAmount: number | null
  incomeTax: number | null
  socialSecurityFund: number | null
  unemploymentInsurance: number | null
  medicalInsurance: number | null
  netAmount: number | null
  currency: string
  /** false until every figure above (not just gross) comes from a real
   * Payroll calculation — the UI reads this, not a per-field null check, to
   * decide whether to show the "calculated once Payroll is active" note. */
  isFullyCalculated: boolean
}

export interface PayrollProvider {
  getFinalSettlementSummary(
    employeeId: string,
    context: PayrollSettlementContext
  ): Promise<PayrollSettlementItem[]>
  getLeavePaymentSummary(employeeId: string, leaveDays: number): Promise<LeavePaymentSummary>
}
