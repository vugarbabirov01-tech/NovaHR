"use server"

import { revalidatePath } from "next/cache"

import {
  createLeaveRequest,
  findLeaveRequestById,
  findLeaveRequestsByEmployee,
  findAllLeaveRequests,
  type LeaveRequest,
} from "@/repositories/leave-request-repository"
import { evaluateLeaveRequest, type LeaveRequestEvaluation } from "@/lib/leave/leave-request-service"
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
} from "@/lib/leave/leave-request-decision-service"
import { leaveRequestInputSchema } from "@/lib/validation/leave"
import { uploadDocument } from "@/lib/documents/document-service"
import { DocumentEntityType } from "@/lib/documents/document-entity-types"
import { LeaveAuditAction, LeaveAuditEntityType, recordLeaveAudit } from "@/lib/leave/leave-audit"
import { eventBus } from "@/lib/event-bus/in-memory-event-bus"
import { LeaveEventType } from "@/lib/event-bus/leave-event-types"
import { payrollProvider } from "@/lib/integrations/payroll-provider"
import type { LeavePaymentSummary } from "@/types/integrations/payroll"

/** revalidatePath after every write in this file — submitting, approving,
 * rejecting, and cancelling all change Pending/Used/Current Balance on
 * both the org dashboard and the affected employee's own profile. The
 * Employee Profile tab already client-refetches after a successful action,
 * but the /leave dashboard is a Server Component read on navigation, so
 * without this it would keep serving Next's cached render until an
 * unrelated revalidation happened to clear it. */
function revalidateLeaveSurfaces() {
  revalidatePath("/[locale]/leave", "page")
  revalidatePath("/[locale]/employees/[id]", "page")
}

/**
 * getLeaveRequestsForEmployeeAction/getLeaveRequestByIdAction are read-only,
 * unchanged since Phase 2. submit/approve/reject/cancel below are the
 * writers — submit creates a PENDING_APPROVAL request (no ledger entry);
 * approve/reject/cancel are Phase 4's decision actions, thin wrappers
 * around leave-request-decision-service.ts's business rules.
 */
export async function getLeaveRequestsForEmployeeAction(employeeId: string): Promise<LeaveRequest[]> {
  return findLeaveRequestsByEmployee(employeeId)
}

export async function getLeaveRequestByIdAction(id: string): Promise<LeaveRequest | null> {
  return findLeaveRequestById(id)
}

/** The HR-facing /leave dashboard's read — every request, every employee.
 * Same repository, same LeaveRequest shape as the employee-scoped action
 * above; only the query differs. */
export async function getAllLeaveRequestsAction(): Promise<LeaveRequest[]> {
  return findAllLeaveRequests()
}

export interface PreviewLeaveRequestResult {
  success: boolean
  data?: LeaveRequestEvaluation
  error?: string
}

/**
 * No write. Calls the same evaluateLeaveRequest the submit action re-runs
 * server-side, so what the wizard's Step 2 shows and what submit enforces
 * can never drift apart. Takes leavePeriodStartYear only to match
 * leaveRequestInputSchema's shape (the same schema submit parses against) —
 * evaluateLeaveRequest itself never receives it, since the period doesn't
 * affect any date/balance calculation (see LeaveRequest.leavePeriodStartYear's
 * schema comment).
 */
export async function previewLeaveRequestAction(
  employeeId: string,
  leaveTypeId: string,
  startDate: string,
  numberOfDays: number,
  leavePeriodStartYear: number,
  companyId?: string | null,
  branchId?: string | null
): Promise<PreviewLeaveRequestResult> {
  const parsed = leaveRequestInputSchema.safeParse({
    employeeId,
    leaveTypeId,
    companyId: companyId ?? undefined,
    branchId: branchId ?? undefined,
    startDate,
    numberOfDays,
    leavePeriodStartYear,
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  try {
    const evaluation = await evaluateLeaveRequest(
      parsed.data.employeeId,
      parsed.data.leaveTypeId,
      new Date(parsed.data.startDate),
      parsed.data.numberOfDays,
      { companyId: parsed.data.companyId, branchId: parsed.data.branchId }
    )
    return { success: true, data: evaluation }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not evaluate leave request." }
  }
}

/**
 * Read-only, thin wrapper around the Payroll integration — Leave never
 * calculates salary/tax/insurance figures itself, only asks Payroll for
 * them, same module boundary the Termination wizard already uses for its
 * own final settlement summary (see lib/termination/actions.ts).
 */
export async function getLeavePaymentSummaryAction(
  employeeId: string,
  leaveDays: number
): Promise<LeavePaymentSummary> {
  return payrollProvider.getLeavePaymentSummary(employeeId, leaveDays)
}

export interface SubmitLeaveRequestResult {
  success: boolean
  data?: {
    leaveRequest: LeaveRequest
    documentUploaded: boolean
  }
  /** Present when a BLOCK-mode policy rejected the submission, so the UI can
   * re-render the same balance banner Step 2 already showed. */
  evaluation?: LeaveRequestEvaluation
  error?: string
}

/**
 * Re-runs evaluateLeaveRequest server-side — never trusts the client-shown
 * preview. If the applicable policy is BLOCK and the balance is
 * insufficient, nothing is created. Otherwise creates the LeaveRequest with
 * the *calculated* end date (never the client-entered one), optionally
 * attaches the uploaded leave application document, records an audit entry,
 * and publishes LeaveRequestSubmitted. Still writes zero LeaveLedgerEntry
 * rows and makes zero approval decisions — both remain out of scope.
 */
export async function submitLeaveRequestAction(formData: FormData): Promise<SubmitLeaveRequestResult> {
  const rawNumberOfDays = formData.get("numberOfDays")
  const rawLeavePeriodStartYear = formData.get("leavePeriodStartYear")
  const parsed = leaveRequestInputSchema.safeParse({
    employeeId: formData.get("employeeId"),
    leaveTypeId: formData.get("leaveTypeId"),
    companyId: formData.get("companyId") || undefined,
    branchId: formData.get("branchId") || undefined,
    startDate: formData.get("startDate"),
    numberOfDays: typeof rawNumberOfDays === "string" ? Number(rawNumberOfDays) : rawNumberOfDays,
    leavePeriodStartYear:
      typeof rawLeavePeriodStartYear === "string" ? Number(rawLeavePeriodStartYear) : rawLeavePeriodStartYear,
    reason: formData.get("reason") || undefined,
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const startDate = new Date(parsed.data.startDate)

  let evaluation: LeaveRequestEvaluation
  try {
    evaluation = await evaluateLeaveRequest(
      parsed.data.employeeId,
      parsed.data.leaveTypeId,
      startDate,
      parsed.data.numberOfDays,
      { companyId: parsed.data.companyId, branchId: parsed.data.branchId }
    )
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not evaluate leave request." }
  }

  if (evaluation.balanceValidationMode === "BLOCK" && !evaluation.isBalanceSufficient) {
    return { success: false, error: "insufficient-balance", evaluation }
  }

  let leaveRequest: LeaveRequest
  try {
    leaveRequest = await createLeaveRequest({
      employeeId: parsed.data.employeeId,
      leaveTypeId: parsed.data.leaveTypeId,
      companyId: parsed.data.companyId ?? null,
      branchId: parsed.data.branchId ?? null,
      startDate,
      endDate: new Date(evaluation.returnToWork.lastLeaveDay),
      requestedUnits: parsed.data.numberOfDays,
      leavePeriodStartYear: parsed.data.leavePeriodStartYear,
      reason: parsed.data.reason ?? null,
      status: "PENDING_APPROVAL",
    })
  } catch {
    return { success: false, error: "Could not create leave request.", evaluation }
  }

  let documentUploaded = false
  const file = formData.get("document")
  if (file instanceof File && file.size > 0) {
    try {
      const data = Buffer.from(await file.arrayBuffer())
      await uploadDocument({
        entityType: DocumentEntityType.LeaveRequest,
        entityId: leaveRequest.id,
        category: "leave-application",
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        data,
        uploadedBy: "HR",
        allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
      })
      documentUploaded = true
    } catch {
      // The request itself is the source of truth for the leave, not the
      // scan of it — a failed attachment doesn't roll back an otherwise
      // valid submission. HR can attach the document again afterward.
    }
  }

  await recordLeaveAudit({
    entityType: LeaveAuditEntityType.LeaveRequest,
    entityId: leaveRequest.id,
    action: LeaveAuditAction.LeaveRequestSubmitted,
    actor: "HR",
  })

  await eventBus.publish({
    id: `EVT-${leaveRequest.id}-${LeaveEventType.LeaveRequestSubmitted}`,
    type: LeaveEventType.LeaveRequestSubmitted,
    payload: { employeeId: parsed.data.employeeId, leaveRequestId: leaveRequest.id },
    timestamp: new Date().toISOString(),
  })

  // A new PENDING_APPROVAL request changes the Pending Leave total (and,
  // for a first-ever request, may be what first makes an opening-balance
  // fallback kick in) on both the org-wide dashboard and this employee's
  // own profile — the Employee Profile tab already client-refetches after
  // a successful submit, but the /leave dashboard is a Server Component
  // read on navigation, so without this it would keep serving Next's
  // cached render until an unrelated revalidation happened to clear it.
  revalidateLeaveSurfaces()

  return { success: true, data: { leaveRequest, documentUploaded } }
}

export interface LeaveRequestDecisionActionResult {
  success: boolean
  data?: { leaveRequest: LeaveRequest }
  error?: string
}

/**
 * The only place a PENDING_APPROVAL request becomes APPROVED — writes the
 * LEAVE_TAKEN ledger entry (see leave-request-decision-service.ts for the
 * full Pending/Approved/Rejected/Cancelled rule this implements).
 */
export async function approveLeaveRequestAction(leaveRequestId: string): Promise<LeaveRequestDecisionActionResult> {
  try {
    const { leaveRequest } = await approveLeaveRequest(leaveRequestId)
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.LeaveRequest,
      entityId: leaveRequest.id,
      action: LeaveAuditAction.LeaveRequestApproved,
      actor: "HR",
    })
    await eventBus.publish({
      id: `EVT-${leaveRequest.id}-${LeaveEventType.LeaveRequestApproved}`,
      type: LeaveEventType.LeaveRequestApproved,
      payload: { employeeId: leaveRequest.employeeId, leaveRequestId: leaveRequest.id },
      timestamp: new Date().toISOString(),
    })
    revalidateLeaveSurfaces()
    return { success: true, data: { leaveRequest } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not approve leave request." }
  }
}

/** Never writes a ledger entry — a rejected request had nothing to
 * reverse, since PENDING_APPROVAL never touched the ledger either. */
export async function rejectLeaveRequestAction(
  leaveRequestId: string,
  reason?: string
): Promise<LeaveRequestDecisionActionResult> {
  try {
    const { leaveRequest } = await rejectLeaveRequest(leaveRequestId, reason)
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.LeaveRequest,
      entityId: leaveRequest.id,
      action: LeaveAuditAction.LeaveRequestRejected,
      actor: "HR",
    })
    await eventBus.publish({
      id: `EVT-${leaveRequest.id}-${LeaveEventType.LeaveRequestRejected}`,
      type: LeaveEventType.LeaveRequestRejected,
      payload: { employeeId: leaveRequest.employeeId, leaveRequestId: leaveRequest.id },
      timestamp: new Date().toISOString(),
    })
    revalidateLeaveSurfaces()
    return { success: true, data: { leaveRequest } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not reject leave request." }
  }
}

/** Cancels either a still-pending or an already-approved request. Only the
 * approved case writes a reversing LEAVE_CANCELLED ledger entry — see
 * leave-request-decision-service.ts. */
export async function cancelLeaveRequestAction(
  leaveRequestId: string,
  reason?: string
): Promise<LeaveRequestDecisionActionResult> {
  try {
    const { leaveRequest } = await cancelLeaveRequest(leaveRequestId, reason)
    await recordLeaveAudit({
      entityType: LeaveAuditEntityType.LeaveRequest,
      entityId: leaveRequest.id,
      action: LeaveAuditAction.LeaveRequestCancelled,
      actor: "HR",
    })
    await eventBus.publish({
      id: `EVT-${leaveRequest.id}-${LeaveEventType.LeaveRequestCancelled}`,
      type: LeaveEventType.LeaveRequestCancelled,
      payload: { employeeId: leaveRequest.employeeId, leaveRequestId: leaveRequest.id },
      timestamp: new Date().toISOString(),
    })
    revalidateLeaveSurfaces()
    return { success: true, data: { leaveRequest } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not cancel leave request." }
  }
}
