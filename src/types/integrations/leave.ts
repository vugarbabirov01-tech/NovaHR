export interface LeaveBalanceSummary {
  annualLeaveEarned: number
  annualLeaveUsed: number
  remainingLeave: number
  settlementMethod: "paid" | "expired" | "manual-decision" | null
}

export interface LeaveProvider {
  getLeaveBalance(employeeId: string): Promise<LeaveBalanceSummary | null>
}
