import { findEmployeeById } from "@/repositories/employee-repository"
import type {
  LeavePaymentSummary,
  PayrollProvider,
  PayrollSettlementContext,
  PayrollSettlementItem,
} from "@/types/integrations/payroll"

// Placeholder divisor only — the real average daily wage is a statutory
// calculation over the employee's actual last-12-months Payroll earnings,
// not a fixed 30. Used solely to estimate a gross figure until the real
// Payroll engine replaces this whole method.
const PLACEHOLDER_DAYS_IN_MONTH = 30

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Temporary adapter. Base Salary/Bonuses/Allowances are real, already-entered
 * payroll record data — safe to read directly, no calculation involved. The
 * remaining four items are genuine settlement CALCULATIONS (turning leave
 * days or outstanding assets into a currency figure, netting deductions, an
 * estimated total) that only a real Payroll engine can own — this adapter
 * returns null for those rather than fabricating a number, and the wizard
 * renders the "will be calculated after Payroll integration" message per row.
 */
class MockPayrollProvider implements PayrollProvider {
  async getFinalSettlementSummary(
    employeeId: string,
    _context: PayrollSettlementContext
  ): Promise<PayrollSettlementItem[]> {
    const profile = await findEmployeeById(employeeId)
    const currency = profile?.payroll.currency ?? "AZN"
    const allowancesTotal = profile?.payroll.allowances.reduce((sum, a) => sum + a.amount, 0) ?? 0

    return [
      { key: "baseSalary", amount: profile?.payroll.baseSalary ?? null, currency },
      { key: "bonuses", amount: profile?.payroll.bonus ?? null, currency },
      { key: "allowances", amount: profile ? allowancesTotal : null, currency },
      { key: "unusedLeaveCompensation", amount: null, currency },
      { key: "deductions", amount: null, currency },
      { key: "outstandingAssetDeductions", amount: null, currency },
      { key: "estimatedFinalPayment", amount: null, currency },
    ]
  }

  /**
   * Same "real now, null until Payroll" split as getFinalSettlementSummary
   * above: baseSalary is a real, already-entered payroll record field, so
   * average daily salary and gross are derivable today. Tax/DSMF/
   * unemployment/medical insurance/net all require the real Payroll
   * engine's statutory rules — this adapter never fabricates them.
   */
  async getLeavePaymentSummary(employeeId: string, leaveDays: number): Promise<LeavePaymentSummary> {
    const profile = await findEmployeeById(employeeId)
    const currency = profile?.payroll.currency ?? "AZN"
    const averageMonthlySalary = profile?.payroll.baseSalary ?? null
    const averageDailySalary =
      averageMonthlySalary !== null ? roundToTwoDecimals(averageMonthlySalary / PLACEHOLDER_DAYS_IN_MONTH) : null
    const grossAmount = averageDailySalary !== null ? roundToTwoDecimals(averageDailySalary * leaveDays) : null

    return {
      averageMonthlySalary,
      averageDailySalary,
      leaveDays,
      grossAmount,
      incomeTax: null,
      socialSecurityFund: null,
      unemploymentInsurance: null,
      medicalInsurance: null,
      netAmount: null,
      currency,
      isFullyCalculated: false,
    }
  }
}

export const payrollProvider: PayrollProvider = new MockPayrollProvider()
