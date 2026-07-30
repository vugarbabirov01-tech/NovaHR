import type { ApprovalInstanceStatus, ApprovalStepInstanceStatus, ApprovalDecision } from "@/generated/prisma/enums"

/**
 * The single source of truth for which status transitions are legal, at
 * every level (instance / step instance / per-approver decision). Nothing
 * else in the Approval Engine is allowed to decide transition legality —
 * every status-mutating repository call the engine makes goes through
 * assertValidInstanceTransition/assertValidStepInstanceTransition first.
 * Pure, no DB access, fully unit-testable in isolation.
 *
 * Entity-agnostic by construction: nothing here knows what a LEAVE_REQUEST
 * or an ApprovalStepDefinition's approverResolutionType even is — this
 * only ever reasons about the closed, structural status vocabulary itself.
 */

export const INSTANCE_TRANSITIONS: Record<ApprovalInstanceStatus, ApprovalInstanceStatus[]> = {
  // Not produced by Phase 4C (submitForApproval creates directly in
  // PENDING) — modeled for a possible future two-phase create/submit API,
  // so adding that later needs no change here.
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["APPROVED", "PARTIALLY_APPROVED", "REJECTED", "RETURNED", "CANCELLED", "EXPIRED"],
  // APPROVED and PARTIALLY_APPROVED are deliberately NOT reopenable in
  // Phase 4C — see the self-review's point 2: unwinding something already
  // fully/partially approved may have real downstream side effects the
  // generic engine has no way to know about. A future phase can widen this
  // explicitly if a real need shows up; it is not an oversight.
  APPROVED: [],
  PARTIALLY_APPROVED: [],
  REJECTED: ["IN_REVIEW"],
  RETURNED: ["IN_REVIEW"],
  CANCELLED: ["IN_REVIEW"],
  EXPIRED: ["IN_REVIEW"],
}

/** Exactly the statuses reopenApprovalInstance may start from — derived
 * from INSTANCE_TRANSITIONS rather than restated, so the two can never
 * drift apart. Used as an explicit up-front guard (not just relying on
 * assertValidInstanceTransition's from===to shortcut, which exists for
 * legitimate same-status advances like multi-step activation and would
 * otherwise let a reopen call silently no-op on an already-IN_REVIEW
 * instance instead of rejecting it as a caller error). */
export const REOPENABLE_INSTANCE_STATUSES: ReadonlySet<ApprovalInstanceStatus> = new Set(
  (Object.keys(INSTANCE_TRANSITIONS) as ApprovalInstanceStatus[]).filter((status) =>
    INSTANCE_TRANSITIONS[status].includes("IN_REVIEW")
  )
)

export const TERMINAL_INSTANCE_STATUSES: ReadonlySet<ApprovalInstanceStatus> = new Set([
  "APPROVED",
  "PARTIALLY_APPROVED",
  "REJECTED",
  "RETURNED",
  "CANCELLED",
  "EXPIRED",
])

export function isTerminalInstanceStatus(status: ApprovalInstanceStatus): boolean {
  return TERMINAL_INSTANCE_STATUSES.has(status)
}

/** Array form of the complement of TERMINAL_INSTANCE_STATUSES — Prisma's
 * `in`/`notIn` filters want an array, not a Set. */
export const NON_TERMINAL_INSTANCE_STATUSES: ApprovalInstanceStatus[] = ["DRAFT", "PENDING", "IN_REVIEW"]

export function assertValidInstanceTransition(from: ApprovalInstanceStatus, to: ApprovalInstanceStatus): void {
  if (from === to) return
  if (!INSTANCE_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Illegal approval instance transition: ${from} -> ${to}.`)
  }
}

export const STEP_INSTANCE_TRANSITIONS: Record<ApprovalStepInstanceStatus, ApprovalStepInstanceStatus[]> = {
  PENDING: ["ACTIVE", "SKIPPED"],
  ACTIVE: ["APPROVED", "REJECTED", "RETURNED", "SKIPPED", "ESCALATED", "EXPIRED"],
  APPROVED: [],
  REJECTED: [],
  RETURNED: [],
  SKIPPED: [],
  // Phase 4C never produces ESCALATED — that's Phase 4F's SLA sweep.
  // Left with no outgoing edges here; 4F's own self-review extends this
  // when it exists, rather than 4C guessing its shape now.
  ESCALATED: [],
  EXPIRED: [],
}

export const TERMINAL_STEP_INSTANCE_STATUSES: ReadonlySet<ApprovalStepInstanceStatus> = new Set([
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "SKIPPED",
  "EXPIRED",
])

export function isTerminalStepInstanceStatus(status: ApprovalStepInstanceStatus): boolean {
  return TERMINAL_STEP_INSTANCE_STATUSES.has(status)
}

export function assertValidStepInstanceTransition(
  from: ApprovalStepInstanceStatus,
  to: ApprovalStepInstanceStatus
): void {
  if (from === to) return
  if (!STEP_INSTANCE_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Illegal approval step instance transition: ${from} -> ${to}.`)
  }
}

/** A decision, once made, is immutable — PENDING is the only status a
 * decision can transition away from. This is also the idempotency/
 * concurrency guard: a conditional UPDATE ... WHERE decision = 'PENDING'
 * is what makes recordApproverDecision safe under retries and concurrent
 * callers (see approval-step-approver-repository.ts). */
export function assertValidDecisionTransition(from: ApprovalDecision, to: ApprovalDecision): void {
  if (from === to) return
  if (from !== "PENDING") {
    throw new Error(`Illegal approval decision transition: ${from} -> ${to}. A decision is immutable once made.`)
  }
}

/** The one place activeKey's format is defined — both the repository
 * (write) and the engine service (retry-lookup) derive it from here so
 * the two can never drift apart. */
export function computeApprovalInstanceActiveKey(entityType: string, entityId: string): string {
  return `${entityType}::${entityId}`
}
