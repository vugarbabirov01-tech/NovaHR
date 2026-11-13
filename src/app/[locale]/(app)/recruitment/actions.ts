"use server"

import {
  addApplicationNote,
  addCandidateToRequisition,
  createRequisition,
  moveApplication,
  RecruitmentError,
  transitionRequisition,
  updateRequisition,
  type AddCandidateResult,
} from "@/lib/recruitment/recruitment-service"
import { REQUISITION_STATUSES, type CandidateInput, type RequisitionInput, type RequisitionStatus } from "@/lib/recruitment/recruitment-rules"

export type RecruitmentResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; code: string }

async function run<T>(fn: () => Promise<T>): Promise<{ success: true; data: T } | { success: false; code: string }> {
  try {
    return { success: true, data: await fn() }
  } catch (error) {
    if (error instanceof RecruitmentError) return { success: false, code: error.code }
    return { success: false, code: "unknown" }
  }
}

export async function createRequisitionAction(input: RequisitionInput) {
  return run(() => createRequisition(input))
}

export async function updateRequisitionAction(id: string, input: RequisitionInput) {
  return run(() => updateRequisition(id, input))
}

export async function transitionRequisitionAction(id: string, to: string, note?: string) {
  if (!(REQUISITION_STATUSES as readonly string[]).includes(to)) return { success: false as const, code: "invalidTransition" }
  return run(() => transitionRequisition(id, to as RequisitionStatus, note))
}

export async function addCandidateAction(
  requisitionId: string,
  input: CandidateInput,
  options?: { existingCandidateId?: string; confirmNew?: boolean }
): Promise<{ success: true; data: AddCandidateResult } | { success: false; code: string }> {
  return run(() => addCandidateToRequisition(requisitionId, input, options))
}

export async function moveApplicationAction(applicationId: string, to: string, rejectionReason?: string) {
  return run(() => moveApplication(applicationId, to, rejectionReason))
}

export async function addApplicationNoteAction(
  applicationId: string,
  input: { kind: string; text: string; rating?: number | null }
) {
  return run(() => addApplicationNote(applicationId, input))
}
