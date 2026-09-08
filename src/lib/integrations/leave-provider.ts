import { findEmployeeById } from "@/repositories/employee-repository"
import type { LeaveBalanceSummary, LeaveProvider } from "@/types/integrations/leave"

/**
 * Temporary adapter reading the employee's own leave record (already real,
 * already entered data — not a calculation). settlementMethod has no real
 * source yet: no Leave engine exists to decide it, so it comes back null and
 * the wizard renders that field as unavailable rather than guessing.
 */
class MockLeaveProvider implements LeaveProvider {
  async getLeaveBalance(employeeId: string): Promise<LeaveBalanceSummary | null> {
    const profile = await findEmployeeById(employeeId)
    if (!profile) return null

    return {
      annualLeaveEarned: profile.leave.annualLeaveEntitlement + profile.leave.additionalLeaveEntitlement,
      annualLeaveUsed: profile.leave.usedLeaveDays,
      remainingLeave: profile.leave.remainingLeaveDays,
      settlementMethod: null,
    }
  }
}

export const leaveProvider: LeaveProvider = new MockLeaveProvider()
