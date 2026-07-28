"use server"

import { revalidatePath } from "next/cache"

import { getEmployeeById, updateEmployeeProfile } from "@/data/employee-directory"
import { addOffboardingRecord } from "@/data/offboarding-directory"
import { assetProvider } from "@/lib/integrations/asset-management-provider"
import { payrollProvider } from "@/lib/integrations/payroll-provider"
import { leaveProvider } from "@/lib/integrations/leave-provider"
import { documentProvider } from "@/lib/integrations/document-provider"
import { eventBus } from "@/lib/event-bus/in-memory-event-bus"
import { OffboardingEventType } from "@/lib/event-bus/event-types"
import type { AssetAssignment, AssetReturnUpdate } from "@/types/integrations/asset-management"
import type { TerminationDocumentType } from "@/types/integrations/documents"
import type { LeaveBalanceSummary } from "@/types/integrations/leave"
import type { PayrollSettlementItem } from "@/types/integrations/payroll"
import type { OffboardingChecklistState, OffboardingRecord, TerminationReason } from "@/types/offboarding"

const ALL_DOCUMENT_TYPES: TerminationDocumentType[] = [
  "termination-order",
  "asset-return-form",
  "final-settlement-document",
  "exit-clearance",
]

function computeChecklistCompletionPercent(checklist: OffboardingChecklistState): number {
  const values = Object.values(checklist)
  const done = values.filter(Boolean).length
  return Math.round((done / values.length) * 100)
}

/** Read-only fetches the wizard calls when it opens — thin wrappers around
 * the relevant provider, the only entry points anything outside those
 * integration modules ever calls. */
export async function getAssignedAssetsAction(employeeId: string): Promise<AssetAssignment[]> {
  return assetProvider.getAssignedAssets(employeeId)
}

export async function getLeaveBalanceAction(employeeId: string): Promise<LeaveBalanceSummary | null> {
  return leaveProvider.getLeaveBalance(employeeId)
}

export async function getFinalSettlementSummaryAction(
  employeeId: string,
  context: { unusedLeaveDays: number; outstandingAssetCount: number }
): Promise<PayrollSettlementItem[]> {
  return payrollProvider.getFinalSettlementSummary(employeeId, context)
}

export interface TerminateEmployeePayload {
  terminationDate: string
  lastWorkingDay: string
  reason: TerminationReason
  labourCodeArticle?: string
  notes?: string
  assetReturns: AssetReturnUpdate[]
  checklist: OffboardingChecklistState
}

export interface TerminateEmployeeResult {
  success: boolean
  offboardingRecordId?: string
  error?: "not-found"
}

/**
 * The one Finish-step orchestration. Employee module only ever calls this —
 * every piece of termination business logic (the offboarding record, the
 * asset/leave/payroll integration calls, the domain events, the document
 * requests) lives here, inside the Termination module, not in
 * employees/actions.ts.
 */
export async function terminateEmployeeAction(
  employeeId: string,
  payload: TerminateEmployeePayload
): Promise<TerminateEmployeeResult> {
  const profile = getEmployeeById(employeeId)
  if (!profile) {
    return { success: false, error: "not-found" }
  }

  // Asset Management owns the return mutation — Termination only requests it
  // through the provider, never touches asset data directly.
  await assetProvider.recordAssetReturns(employeeId, payload.assetReturns)
  const assignedAssets = await assetProvider.getAssignedAssets(employeeId)
  const outstandingAssetCount = assignedAssets.filter((asset) => asset.status === "assigned").length

  const leaveBalanceSnapshot = await leaveProvider.getLeaveBalance(employeeId)
  const payrollSummarySnapshot = await payrollProvider.getFinalSettlementSummary(employeeId, {
    unusedLeaveDays: leaveBalanceSnapshot?.remainingLeave ?? 0,
    outstandingAssetCount,
  })

  const now = new Date().toISOString()
  const offboardingRecordId = `OFF-${employeeId}-${Date.now()}`

  const record: OffboardingRecord = {
    id: offboardingRecordId,
    employeeId,
    createdAt: now,
    status: "completed",
    terminationDate: payload.terminationDate,
    lastWorkingDay: payload.lastWorkingDay,
    reason: payload.reason,
    labourCodeArticle: payload.labourCodeArticle,
    notes: payload.notes,
    checklist: payload.checklist,
    checklistCompletionPercent: computeChecklistCompletionPercent(payload.checklist),
    assetReturns: assignedAssets.map((asset) => ({
      assetId: asset.id,
      name: asset.name,
      category: asset.category,
      status:
        payload.assetReturns.find((update) => update.assetId === asset.id)?.status ?? asset.status,
    })),
    leaveBalanceSnapshot,
    payrollSummarySnapshot,
  }

  addOffboardingRecord(record)

  // Employee module owns only status + the reference — every termination
  // detail above lives exclusively on the OffboardingRecord just created.
  updateEmployeeProfile(employeeId, {
    ...profile,
    employmentStatus: "terminated",
    terminationRecordId: offboardingRecordId,
    employment: {
      ...profile.employment,
      history: [
        ...profile.employment.history,
        {
          id: `EH-${employeeId}-${profile.employment.history.length + 1}`,
          date: payload.terminationDate,
          type: "termination",
          title: "Employment terminated",
          description: `Reason: ${payload.reason}. Last working day: ${payload.lastWorkingDay}.`,
        },
      ],
    },
    auditLog: [
      ...profile.auditLog,
      {
        id: `AUD-${employeeId}-${profile.auditLog.length + 1}`,
        timestamp: now,
        actor: "System",
        action: "employee.terminated",
      },
    ],
  })

  // Termination only publishes — it never imports or knows about whichever
  // modules (Notification, Payroll, Asset Management, ...) subscribe.
  const eventTypes = [
    OffboardingEventType.OffboardingStarted,
    OffboardingEventType.AssetReturnRequested,
    OffboardingEventType.PayrollSettlementRequested,
    OffboardingEventType.EmployeeTerminated,
    OffboardingEventType.TerminationCompleted,
    OffboardingEventType.HRNotification,
    OffboardingEventType.PayrollNotification,
    OffboardingEventType.ITNotification,
  ]
  for (const type of eventTypes) {
    await eventBus.publish({
      id: `EVT-${offboardingRecordId}-${type}`,
      type,
      payload: { employeeId, offboardingRecordId },
      timestamp: now,
    })
  }

  // Requests only — no PDF generation, no templates.
  for (const type of ALL_DOCUMENT_TYPES) {
    await documentProvider.requestDocument({ type, employeeId, requestedAt: now })
  }

  revalidatePath("/[locale]/employees", "page")
  revalidatePath("/[locale]/employees/[id]", "page")
  revalidatePath("/[locale]/dashboard", "page")

  return { success: true, offboardingRecordId }
}
