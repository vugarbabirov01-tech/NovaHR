import { getEmployeeById } from "@/data/employee-directory"
import {
  calculateReturnToWork,
  resolveLeaveEligibility,
  type LeaveEligibilityResult,
  type ReturnToWorkResult,
} from "@/lib/leave/leave-policy-resolution-service"
import { computeLeaveBalance } from "@/lib/leave/leave-balance-service"
import { findActiveLeavePoliciesByLeaveType } from "@/repositories/leave-policy-repository"
import type { LeaveBalanceStatement } from "@/types/leave"

function toDateOnlyIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Which LeavePolicy applies to this employee's leave type — prefers a
 * company-scoped policy over the global (companyId: null) default; if
 * nothing is configured at all, callers fall back to "WARN" (the schema's
 * own default), never to a hardcoded assumption about the leave type.
 */
async function resolveBalanceValidationMode(
  leaveTypeId: string,
  companyId?: string | null
): Promise<"BLOCK" | "WARN"> {
  const policies = await findActiveLeavePoliciesByLeaveType(leaveTypeId)
  if (policies.length === 0) return "WARN"

  const companyMatch = companyId ? policies.find((p) => p.companyId === companyId) : undefined
  const globalMatch = policies.find((p) => p.companyId === null)
  const policy = companyMatch ?? globalMatch ?? policies[0]

  return policy.balanceValidationMode === "BLOCK" ? "BLOCK" : "WARN"
}

export interface LeaveRequestEvaluationContext {
  companyId?: string | null
  branchId?: string | null
}

export interface LeaveRequestEvaluation {
  employeeId: string
  leaveTypeId: string
  startDate: string
  numberOfDays: number
  returnToWork: ReturnToWorkResult
  eligibility: LeaveEligibilityResult
  balance: LeaveBalanceStatement
  balanceValidationMode: "BLOCK" | "WARN"
  isBalanceSufficient: boolean
}

/**
 * The one place a Leave Request's preview and its submission both go
 * through — so they can never drift apart. Combines three already-existing
 * engines (Phase 2's balance, Phase 3A's eligibility and date calculation)
 * and this phase's one new piece (policy-driven balance validation mode).
 * Read-only — never writes anything, safe to call from a preview action or
 * re-run inside a submit action for server-side re-validation.
 */
export async function evaluateLeaveRequest(
  employeeId: string,
  leaveTypeId: string,
  startDate: Date,
  numberOfDays: number,
  context: LeaveRequestEvaluationContext = {}
): Promise<LeaveRequestEvaluation> {
  const profile = getEmployeeById(employeeId)
  if (!profile) throw new Error("Employee not found.")

  const workingDayContext = {
    workScheduleLabel: profile.employment.workSchedule,
    companyId: context.companyId ?? undefined,
    branchId: context.branchId ?? undefined,
  }

  const eligibility = resolveLeaveEligibility(profile, startDate)

  const [returnToWork, balance, balanceValidationMode] = await Promise.all([
    calculateReturnToWork(startDate, numberOfDays, workingDayContext),
    computeLeaveBalance(employeeId, leaveTypeId, startDate),
    resolveBalanceValidationMode(leaveTypeId, context.companyId ?? null),
  ])

  return {
    employeeId,
    leaveTypeId,
    startDate: toDateOnlyIso(startDate),
    numberOfDays,
    returnToWork,
    eligibility,
    balance,
    balanceValidationMode,
    isBalanceSufficient: balance.remaining >= numberOfDays,
  }
}
