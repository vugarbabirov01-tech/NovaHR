import { getEmployeeById } from "@/data/employee-directory"
import type {
  PayrollProvider,
  PayrollSettlementContext,
  PayrollSettlementItem,
} from "@/types/integrations/payroll"

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
    const profile = getEmployeeById(employeeId)
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
}

export const payrollProvider: PayrollProvider = new MockPayrollProvider()
