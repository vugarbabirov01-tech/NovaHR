import type { AnnualLeaveEntitlementResult } from "@/lib/leave/leave-policy-resolution-service"

const BASE_ARTICLES = new Set(["Art. 114.2", "Art. 114.3", "Art. 119.1", "Art. 119.2", "Art. 120", "Contract Base"])

/** Plain, serialisable breakdown of an entitlement for display (client-safe). */
export interface LeaveEntitlementSummary {
  totalDays: number
  /** Statutory or contract base, or a special-status base (disability, veteran, minor). */
  baseDays: number
  /** Art. 116 length-of-service days. */
  seniorityDays: number
  /** Everything else: hazardous work, women with children, collective agreement, company policy, manual adjustment. */
  otherDays: number
}

export function summarizeEntitlement(result: AnnualLeaveEntitlementResult): LeaveEntitlementSummary {
  let baseDays = 0
  let seniorityDays = 0
  let otherDays = 0
  for (const component of result.components) {
    if (component.source === "gap") continue
    if (component.article === "Art. 116") seniorityDays += component.days
    else if (BASE_ARTICLES.has(component.article)) baseDays += component.days
    else otherDays += component.days
  }
  return { totalDays: result.totalDays, baseDays, seniorityDays, otherDays }
}
