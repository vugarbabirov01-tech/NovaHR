// Offboarding module — the sole owner of everything about how and why an
// employee left. EmployeeProfile only ever holds employmentStatus and an
// optional terminationRecordId pointing here; every other termination detail
// (date, reason, checklist, snapshots) lives exclusively on OffboardingRecord.

export type TerminationReason =
  | "resignation"
  | "employer-decision"
  | "mutual-agreement"
  | "end-of-contract"
  | "retirement"
  | "death"
  | "other"

/**
 * Lifecycle of the offboarding process itself — distinct from
 * EmployeeProfile.employmentStatus, since offboarding can keep moving
 * (payroll settling, assets still outstanding) after the employment status
 * has already flipped to "terminated".
 */
export type OffboardingStatus =
  | "draft"
  | "in_progress"
  | "waiting_payroll"
  | "waiting_assets"
  | "waiting_documents"
  | "completed"
  | "cancelled"

export interface OffboardingChecklistState {
  companyPropertyReturned: boolean
  accessCardDisabled: boolean
  companyEmailDisabled: boolean
  hrmsAccountDisabled: boolean
  exitInterviewCompleted: boolean
  documentsDelivered: boolean
  finalSettlementApproved: boolean
}

export const defaultOffboardingChecklist: OffboardingChecklistState = {
  companyPropertyReturned: false,
  accessCardDisabled: false,
  companyEmailDisabled: false,
  hrmsAccountDisabled: false,
  exitInterviewCompleted: false,
  documentsDelivered: false,
  finalSettlementApproved: false,
}

/**
 * A snapshot taken at termination time — not a live reference back to Asset
 * Management. What the asset looked like the moment offboarding closed it
 * out, frozen here for the record.
 */
export interface AssetReturnSnapshotItem {
  assetId: string
  name: string
  category: string
  status: "returned" | "assigned" | "lost" | "damaged"
}

export interface LeaveBalanceSnapshot {
  annualLeaveEarned: number
  annualLeaveUsed: number
  remainingLeave: number
  settlementMethod: "paid" | "expired" | "manual-decision" | null
}

export type PayrollSettlementItemKey =
  | "baseSalary"
  | "bonuses"
  | "allowances"
  | "unusedLeaveCompensation"
  | "deductions"
  | "outstandingAssetDeductions"
  | "estimatedFinalPayment"

export interface PayrollSettlementSnapshotItem {
  key: PayrollSettlementItemKey
  amount: number | null // null = not calculable without Payroll module integration
  currency: string
}

export interface OffboardingRecord {
  id: string
  employeeId: string
  createdAt: string
  status: OffboardingStatus
  terminationDate: string
  lastWorkingDay: string
  reason: TerminationReason
  labourCodeArticle?: string
  notes?: string
  checklist: OffboardingChecklistState
  checklistCompletionPercent: number
  assetReturns: AssetReturnSnapshotItem[]
  leaveBalanceSnapshot: LeaveBalanceSnapshot | null
  payrollSummarySnapshot: PayrollSettlementSnapshotItem[]
}
