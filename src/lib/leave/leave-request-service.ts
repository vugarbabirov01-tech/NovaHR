import { findEmployeeById } from "@/repositories/employee-repository"
import {
  calculateReturnToWork,
  resolveLeaveEligibility,
  type LeaveEligibilityResult,
  type ReturnToWorkResult,
} from "@/lib/leave/leave-policy-resolution-service"
import { computeLeaveBalance } from "@/lib/leave/leave-balance-service"
import { findActiveLeavePoliciesByLeaveType } from "@/repositories/leave-policy-repository"
import { findLeaveTypeById } from "@/repositories/leave-type-repository"
import type { LeaveBalanceStatement } from "@/types/leave"

/** Local calendar components, not `.toISOString()` — see the matching doc
 * comment in leave-policy-resolution-service.ts for why: startDate here can
 * be locally-mutated upstream, and reading it back via UTC rolls it back a
 * day in any timezone ahead of UTC. */
function toDateOnlyIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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
  const profile = await findEmployeeById(employeeId)
  if (!profile) throw new Error("Employee not found.")

  // The wizard's dropdown already only lists active types
  // (getActiveLeaveTypesAction), but that's a client-visible filter, not
  // enforcement — this is the one place preview and submit both funnel
  // through, so it's also the one place a retired type (e.g. Maternity/
  // Paternity — see prisma/seed.ts) is rejected server-side, not just hidden.
  const leaveType = await findLeaveTypeById(leaveTypeId)
  if (!leaveType) throw new Error("Leave type not found.")
  if (!leaveType.active) throw new Error("This leave type is no longer available for new requests.")

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
