/**
 * Recruitment domain rules — pure, no database. Statuses and stages are plain
 * strings in the database; this file is the only place their allowed values
 * and transitions are defined.
 */

// ---------------------------------------------------------------------------
// Vacancy (requisition) status flow
// ---------------------------------------------------------------------------

export const REQUISITION_STATUSES = ["DRAFT", "PENDING_APPROVAL", "OPEN", "REJECTED", "FILLED", "CLOSED"] as const
export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number]

const REQUISITION_TRANSITIONS: Record<RequisitionStatus, RequisitionStatus[]> = {
  DRAFT: ["PENDING_APPROVAL"],
  PENDING_APPROVAL: ["OPEN", "REJECTED", "DRAFT"],
  REJECTED: ["DRAFT"],
  OPEN: ["FILLED", "CLOSED"],
  CLOSED: ["OPEN"],
  FILLED: [],
}

export function canTransitionRequisition(from: RequisitionStatus, to: RequisitionStatus): boolean {
  return REQUISITION_TRANSITIONS[from].includes(to)
}

export function nextRequisitionStatuses(from: RequisitionStatus): RequisitionStatus[] {
  return REQUISITION_TRANSITIONS[from]
}

/** The vacancy's own fields can be edited only before it is sent for approval. */
export function isRequisitionEditable(status: RequisitionStatus): boolean {
  return status === "DRAFT" || status === "REJECTED"
}

/** Candidates can be added and moved only while the vacancy is open. */
export function acceptsApplications(status: RequisitionStatus): boolean {
  return status === "OPEN"
}

export const REQUISITION_REASONS = ["NEW_POSITION", "REPLACEMENT"] as const
export type RequisitionReason = (typeof REQUISITION_REASONS)[number]

// ---------------------------------------------------------------------------
// Candidate pipeline
// ---------------------------------------------------------------------------

export const PIPELINE_STAGES = ["NEW", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const CANDIDATE_SOURCES = ["REFERRAL", "JOB_SITE", "SOCIAL", "WALK_IN", "AGENCY", "OTHER"] as const
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number]

export function isPipelineStage(value: string): value is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(value)
}

/** HIRED and REJECTED are final; an application there cannot be moved again. */
export function isFinalStage(stage: PipelineStage): boolean {
  return stage === "HIRED" || stage === "REJECTED"
}

export type StageMoveError = "invalidStage" | "alreadyFinal" | "sameStage" | "reasonRequired"

/** Returns an error code, or null when the move is allowed. */
export function validateStageMove(from: PipelineStage, to: string, rejectionReason?: string): StageMoveError | null {
  if (!isPipelineStage(to)) return "invalidStage"
  if (isFinalStage(from)) return "alreadyFinal"
  if (from === to) return "sameStage"
  if (to === "REJECTED" && !(rejectionReason ?? "").trim()) return "reasonRequired"
  return null
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

export interface RequisitionInput {
  title: string
  departmentId?: string | null
  branchId?: string | null
  openings: number
  salaryMin?: number | null
  salaryMax?: number | null
  reason: string
  description?: string
}

export type RequisitionInputError = "title" | "openings" | "salary" | "reason"

export function validateRequisitionInput(input: RequisitionInput): RequisitionInputError | null {
  if (!input.title.trim() || input.title.length > 120) return "title"
  if (!Number.isInteger(input.openings) || input.openings < 1 || input.openings > 500) return "openings"
  if (!(REQUISITION_REASONS as readonly string[]).includes(input.reason)) return "reason"
  const { salaryMin, salaryMax } = input
  if (salaryMin != null && (!Number.isFinite(salaryMin) || salaryMin < 0)) return "salary"
  if (salaryMax != null && (!Number.isFinite(salaryMax) || salaryMax < 0)) return "salary"
  if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) return "salary"
  return null
}

export interface CandidateInput {
  firstName: string
  lastName: string
  fatherName?: string
  phone?: string
  email?: string
  finCode?: string
  source?: string
  notes?: string
}

export type CandidateInputError = "name" | "contact" | "email" | "fin" | "source"

export function validateCandidateInput(input: CandidateInput): CandidateInputError | null {
  if (!input.firstName.trim() || !input.lastName.trim()) return "name"
  const phone = normalizePhone(input.phone)
  const email = normalizeEmail(input.email)
  if (!phone && !email) return "contact"
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "email"
  const fin = normalizeFin(input.finCode)
  if (fin && !/^[0-9A-Z]{7}$/.test(fin)) return "fin"
  if (input.source && !(CANDIDATE_SOURCES as readonly string[]).includes(input.source)) return "source"
  return null
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export function normalizePhone(value?: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "")
  // 994501234567 and 0501234567 are the same Azerbaijani number: compare the last 9 digits.
  return digits.length > 9 ? digits.slice(-9) : digits
}

export function normalizeEmail(value?: string | null): string {
  return (value ?? "").trim().toLowerCase()
}

export function normalizeFin(value?: string | null): string {
  return (value ?? "").trim().toUpperCase()
}

export interface CandidateIdentity {
  id: string
  phone: string
  email: string
  finCode: string
}

/** Existing candidates that share a FİN, phone or e-mail with the given input. */
export function findDuplicateCandidates<T extends CandidateIdentity>(existing: T[], input: CandidateInput): T[] {
  const fin = normalizeFin(input.finCode)
  const phone = normalizePhone(input.phone)
  const email = normalizeEmail(input.email)
  return existing.filter(
    (candidate) =>
      (fin !== "" && normalizeFin(candidate.finCode) === fin) ||
      (phone !== "" && normalizePhone(candidate.phone) === phone) ||
      (email !== "" && normalizeEmail(candidate.email) === email)
  )
}
