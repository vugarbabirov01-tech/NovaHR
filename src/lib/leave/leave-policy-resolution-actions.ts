"use server"

import {
  calculateReturnToWork,
  isHoliday,
  isWorkingDay,
  resolveAnnualLeaveEntitlement,
  resolveLeaveEligibility,
  type AnnualLeaveEntitlementResult,
  type LeaveEligibilityResult,
  type ReturnToWorkResult,
  type WorkingDayContext,
} from "@/lib/leave/leave-policy-resolution-service"
import type { EmployeeProfile } from "@/types/employee-profile"

/**
 * Thin "use server" wrappers around the Leave Policy Resolution Engine —
 * no logic lives here, only delegation, same shape as
 * leave-balance-actions.ts. Exists so the future Employee Profile / Leave
 * Request UI has an immediately-usable client-callable entry point without
 * this file needing to change later.
 */

export async function resolveAnnualLeaveEntitlementAction(
  profile: EmployeeProfile,
  asOfDate?: string
): Promise<AnnualLeaveEntitlementResult> {
  return resolveAnnualLeaveEntitlement(profile, asOfDate ? new Date(asOfDate) : new Date())
}

export async function resolveLeaveEligibilityAction(
  profile: EmployeeProfile,
  asOfDate?: string
): Promise<LeaveEligibilityResult> {
  return resolveLeaveEligibility(profile, asOfDate ? new Date(asOfDate) : new Date())
}

export async function isWorkingDayAction(date: string, context: WorkingDayContext): Promise<boolean> {
  return isWorkingDay(new Date(date), context)
}

export async function isHolidayAction(date: string, context: WorkingDayContext): Promise<boolean> {
  return isHoliday(new Date(date), context)
}

export async function calculateReturnToWorkAction(
  startDate: string,
  numberOfDays: number,
  context: WorkingDayContext
): Promise<ReturnToWorkResult> {
  return calculateReturnToWork(new Date(startDate), numberOfDays, context)
}
