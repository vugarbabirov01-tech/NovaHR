import { randomUUID } from "node:crypto"

import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { ApprovalDecision, ApprovalActionType } from "@/generated/prisma/enums"
import { eventBus } from "@/lib/event-bus/in-memory-event-bus"
import { ApprovalEventType } from "@/lib/event-bus/approval-event-types"

import {
  findActiveWorkflowDefinitionsByEntityType,
} from "@/repositories/approval-workflow-definition-repository"
import {
  findPublishedWorkflowVersion,
  findWorkflowVersionById,
  type ApprovalWorkflowVersion,
} from "@/repositories/approval-workflow-version-repository"
import { findStepDefinitionsByVersion, findStepDefinitionById } from "@/repositories/approval-step-definition-repository"
import {
  createApprovalInstance,
  findActiveApprovalInstanceForEntity,
  findApprovalInstanceById,
  findApprovalInstancesForEntity,
  updateApprovalInstanceStatus as updateApprovalInstanceStatusRepo,
  type ApprovalInstance,
} from "@/repositories/approval-instance-repository"
import {
  createStepInstance,
  findStepInstancesByApprovalInstance,
  findActiveStepInstances,
  findStepInstanceById,
  updateStepInstanceStatus as updateStepInstanceStatusRepo,
  type ApprovalStepInstance,
} from "@/repositories/approval-step-instance-repository"
import {
  createStepApprover,
  findApproverById,
  findApproversByStepInstance,
  findPendingApprovalsForEmployee as findPendingApprovalsForEmployeeRepo,
  recordApproverDecision as recordApproverDecisionRepo,
  recordApproverViewed as recordApproverViewedRepo,
  type ApprovalStepApprover,
} from "@/repositories/approval-step-approver-repository"
import {
  createApprovalAction,
  findActionsByApprovalInstance,
  type ApprovalAction,
} from "@/repositories/approval-action-repository"

import { evaluateCondition } from "@/lib/approval/approval-condition-evaluator"
import { resolveApprovers } from "@/lib/approval/approval-approver-resolver-registry"
import {
  assertValidInstanceTransition,
  assertValidStepInstanceTransition,
  isTerminalStepInstanceStatus,
  REOPENABLE_INSTANCE_STATUSES,
} from "@/lib/approval/approval-state-machine"

export type { ApprovalInstance, ApprovalStepInstance, ApprovalStepApprover, ApprovalAction }

/**
 * The Core Approval Engine — Phase 4C. Generic, entity-agnostic runtime
 * state machine on top of the Phase 4A/4B schema. Nothing below this
 * comment ever references Leave or any other business module; every fact
 * about "what this approval is for" arrives as entityType/entityId/
 * contextPayload from the caller and is treated as opaque data.
 *
 * Public surface (see the Phase 4C self-review's point 8 for the full
 * reasoning): submitForApproval, recordApprovalDecision,
 * cancelApprovalInstance, reopenApprovalInstance, markApprovalViewed, plus
 * the read helpers at the bottom of this file. Everything else here is an
 * internal implementation detail of those seven operations.
 */

interface PendingEvent {
  type: string
  payload: Record<string, unknown>
}

/** Publish only after the transaction that produced these facts has
 * actually committed — see the self-review's point 6. Never called from
 * inside a $transaction callback. */
async function publishAll(events: PendingEvent[]): Promise<void> {
  for (const event of events) {
    await eventBus.publish({
      id: `EVT-${event.payload.instanceId ?? event.payload.stepInstanceId}-${event.type}-${randomUUID()}`,
      type: event.type,
      payload: event.payload,
      timestamp: new Date().toISOString(),
    })
  }
}

function recordApprovalActionTx(
  tx: PrismaClientOrTransaction,
  approvalInstanceId: string,
  approvalStepInstanceId: string | null,
  actionType: ApprovalActionType,
  actorEmployeeId: string,
  comment?: string | null,
  metadata?: Prisma.InputJsonValue
): Promise<ApprovalAction> {
  return createApprovalAction(
    { approvalInstanceId, approvalStepInstanceId, actionType, actorEmployeeId, comment, metadata },
    tx
  )
}

// ---------------------------------------------------------------------------
// Workflow resolution — which published version applies to this submission.
// ---------------------------------------------------------------------------

export interface SubmissionScope {
  companyId?: string | null
  branchId?: string | null
  departmentId?: string | null
}

async function resolveWorkflowVersionForSubmission(
  entityType: string,
  scope: SubmissionScope,
  contextPayload: unknown
): Promise<ApprovalWorkflowVersion> {
  const candidates = await findActiveWorkflowDefinitionsByEntityType(entityType) // already priority desc
  for (const definition of candidates) {
    if (definition.isTemplate) continue
    if (definition.companyId && definition.companyId !== scope.companyId) continue
    if (definition.branchId && definition.branchId !== scope.branchId) continue
    if (definition.departmentId && definition.departmentId !== scope.departmentId) continue
    if (!evaluateCondition(definition.conditionExpression, contextPayload)) continue

    const version = await findPublishedWorkflowVersion(definition.id)
    if (!version) continue // matched but nothing published yet — try the next candidate

    return version
  }
  throw new Error(
    `No published approval workflow is configured for entityType "${entityType}" for the given scope/context.`
  )
}

// ---------------------------------------------------------------------------
// Activation — the core stepping loop. Shared by submit, decide-and-advance,
// and reopen.
// ---------------------------------------------------------------------------

interface ActivationOutcome {
  instance: ApprovalInstance
  events: PendingEvent[]
}

/**
 * Walks stepOrders starting at fromStepOrder, activating every branch at
 * each order (evaluating conditionExpression, resolving approvers,
 * computing dueAt) until it finds at least one branch that actually goes
 * ACTIVE — at which point it stops and the instance waits for decisions —
 * or it runs out of stepOrders, in which case it finalizes the instance as
 * APPROVED or PARTIALLY_APPROVED. Every write happens through `tx`; the
 * caller owns the surrounding prisma.$transaction.
 */
async function activateFromStepOrder(
  tx: PrismaClientOrTransaction,
  instance: ApprovalInstance,
  fromStepOrder: number,
  contextPayload: unknown
): Promise<ActivationOutcome> {
  const events: PendingEvent[] = []
  const version = await findWorkflowVersionById(instance.workflowVersionId, tx)
  const allStepDefs = await findStepDefinitionsByVersion(instance.workflowVersionId, tx)
  const stepOrders = [...new Set(allStepDefs.map((sd) => sd.stepOrder))]
    .filter((order) => order >= fromStepOrder)
    .sort((a, b) => a - b)

  for (const stepOrder of stepOrders) {
    const defsAtOrder = allStepDefs.filter((sd) => sd.stepOrder === stepOrder)
    let activatedAny = false

    for (const stepDef of defsAtOrder) {
      const stepInstance = await createStepInstance(
        { approvalInstanceId: instance.id, stepDefinitionId: stepDef.id, stepOrder, branchKey: stepDef.branchKey },
        tx
      )

      if (!evaluateCondition(stepDef.conditionExpression, contextPayload)) {
        assertValidStepInstanceTransition("PENDING", "SKIPPED")
        await updateStepInstanceStatusRepo(
          stepInstance.id,
          { fromStatus: "PENDING", toStatus: "SKIPPED", skipReason: "CONDITION_NOT_MET" },
          tx
        )
        continue
      }

      const approverIds = await resolveApprovers(stepDef.approverResolutionType, stepDef.approverResolutionConfig, contextPayload)

      if (approverIds.length === 0) {
        if (!stepDef.skipIfNoApproverResolved) {
          throw new Error(
            `Cannot activate step "${stepDef.name}" (stepOrder ${stepOrder}): no approver could be resolved and skipIfNoApproverResolved is false.`
          )
        }
        assertValidStepInstanceTransition("PENDING", "SKIPPED")
        await updateStepInstanceStatusRepo(
          stepInstance.id,
          { fromStatus: "PENDING", toStatus: "SKIPPED", skipReason: "NO_APPROVER_RESOLVED" },
          tx
        )
        continue
      }

      const now = new Date()
      const slaHours = stepDef.slaHours ?? version?.defaultSlaHours ?? null
      const dueAt = slaHours ? new Date(now.getTime() + slaHours * 60 * 60 * 1000) : null

      assertValidStepInstanceTransition("PENDING", "ACTIVE")
      await updateStepInstanceStatusRepo(
        stepInstance.id,
        { fromStatus: "PENDING", toStatus: "ACTIVE", activatedAt: now, dueAt },
        tx
      )
      for (const approverEmployeeId of approverIds) {
        await createStepApprover({ approvalStepInstanceId: stepInstance.id, approverEmployeeId }, tx)
      }

      events.push({
        type: ApprovalEventType.ApprovalStepActivated,
        payload: {
          entityType: instance.entityType,
          entityId: instance.entityId,
          instanceId: instance.id,
          stepInstanceId: stepInstance.id,
        },
      })
      activatedAny = true
    }

    if (activatedAny) {
      assertValidInstanceTransition(instance.status, "IN_REVIEW")
      const updated = await updateApprovalInstanceStatusRepo(
        instance.id,
        { fromStatus: instance.status, toStatus: "IN_REVIEW", currentStepOrder: stepOrder },
        tx
      )
      if (!updated.instance) throw new Error("Concurrent modification while activating a step — please retry.")
      return { instance: updated.instance, events }
    }
    // Every branch at this stepOrder was skipped — fall through to the next stepOrder.
  }

  // No further stepOrder has anything to activate — finalize. Only the
  // MOST RECENT step instance per (stepOrder, branchKey) counts: after a
  // reopen, findStepInstancesByApprovalInstance also returns the earlier,
  // superseded round's rows (e.g. an original REJECTED branch from before
  // the reopen) — those describe history, not the current outcome, and
  // must not affect this determination. Found via the smoke test's
  // reopen-then-fully-reapprove scenario incorrectly coming back
  // PARTIALLY_APPROVED because a pre-reopen REJECTED row was still there.
  const allStepInstances = await findStepInstancesByApprovalInstance(instance.id, tx)
  const latestByStepKey = new Map<string, (typeof allStepInstances)[number]>()
  for (const si of allStepInstances) {
    const key = `${si.stepOrder}::${si.branchKey}`
    const existing = latestByStepKey.get(key)
    if (!existing || si.createdAt > existing.createdAt) latestByStepKey.set(key, si)
  }
  const isPartial = [...latestByStepKey.values()].some(
    (si) =>
      (si.status === "SKIPPED" && si.skipReason === "NO_APPROVER_RESOLVED") ||
      ((si.status === "REJECTED" || si.status === "RETURNED") && si.skipReason !== "INSTANCE_TERMINATED")
  )
  const finalStatus = isPartial ? "PARTIALLY_APPROVED" : "APPROVED"

  assertValidInstanceTransition(instance.status, finalStatus)
  const updated = await updateApprovalInstanceStatusRepo(
    instance.id,
    { fromStatus: instance.status, toStatus: finalStatus, currentStepOrder: null, decidedAt: new Date() },
    tx
  )
  if (!updated.instance) throw new Error("Concurrent modification while finalizing an instance — please retry.")

  events.push({
    type: finalStatus === "APPROVED" ? ApprovalEventType.ApprovalInstanceApproved : ApprovalEventType.ApprovalInstancePartiallyApproved,
    payload: { entityType: instance.entityType, entityId: instance.entityId, instanceId: instance.id },
  })
  return { instance: updated.instance, events }
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

export interface SubmitForApprovalInput {
  entityType: string
  entityId: string
  contextPayload: Prisma.InputJsonValue
  submittedBy: string
  scope?: SubmissionScope
}

function isActiveKeyConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray((error.meta as { target?: unknown } | undefined)?.target) &&
    ((error.meta as { target: unknown[] }).target as unknown[]).includes("activeKey")
  )
}

/**
 * Idempotent by construction: if an active instance already exists for
 * this (entityType, entityId), returns it rather than creating a second
 * one — whether found by an up-front check or discovered via losing a
 * concurrent create race to the activeKey unique constraint (see the
 * self-review's point 3).
 */
export async function submitForApproval(input: SubmitForApprovalInput): Promise<ApprovalInstance> {
  const existing = await findActiveApprovalInstanceForEntity(input.entityType, input.entityId)
  if (existing) return existing

  const scope = input.scope ?? {}
  const version = await resolveWorkflowVersionForSubmission(input.entityType, scope, input.contextPayload)

  let events: PendingEvent[] = []
  let instance: ApprovalInstance
  try {
    instance = await prisma.$transaction(async (tx) => {
      const created = await createApprovalInstance(
        {
          entityType: input.entityType,
          entityId: input.entityId,
          workflowDefinitionId: version.workflowDefinitionId,
          workflowVersionId: version.id,
          contextPayload: input.contextPayload,
          companyId: scope.companyId ?? null,
          branchId: scope.branchId ?? null,
          departmentId: scope.departmentId ?? null,
          submittedBy: input.submittedBy,
        },
        tx
      )
      await recordApprovalActionTx(tx, created.id, null, "CREATED", input.submittedBy)

      const activation = await activateFromStepOrder(tx, created, 1, input.contextPayload)
      events = [
        {
          type: ApprovalEventType.ApprovalInstanceCreated,
          payload: { entityType: created.entityType, entityId: created.entityId, instanceId: created.id },
        },
        ...activation.events,
      ]
      return activation.instance
    })
  } catch (error) {
    if (isActiveKeyConflict(error)) {
      const raceWinner = await findActiveApprovalInstanceForEntity(input.entityType, input.entityId)
      if (raceWinner) return raceWinner
    }
    throw error
  }

  await publishAll(events)
  return instance
}

// ---------------------------------------------------------------------------
// Decide (approve / reject / return)
// ---------------------------------------------------------------------------

export interface RecordApprovalDecisionInput {
  stepApproverId: string
  actorEmployeeId: string
  decision: Extract<ApprovalDecision, "APPROVED" | "REJECTED" | "RETURNED">
  comment?: string | null
}

function decisionToStepStatus(decision: "APPROVED" | "REJECTED" | "RETURNED") {
  return decision // ApprovalStepInstanceStatus shares these three literal names with ApprovalDecision.
}

function decisionToActionType(decision: "APPROVED" | "REJECTED" | "RETURNED"): ApprovalActionType {
  return decision
}

function decisionToInstanceStatus(decision: "REJECTED" | "RETURNED") {
  return decision // ApprovalInstanceStatus also shares REJECTED/RETURNED literally.
}

/**
 * The one entry point for every decision verb (approve/reject/return —
 * see approval-engine-actions.ts for the three named wrappers). Idempotent
 * and concurrency-safe: the underlying repository call is a conditional
 * UPDATE ... WHERE decision = 'PENDING'; if it affects zero rows, this
 * function returns the already-decided record and publishes nothing new.
 */
export async function recordApprovalDecision(input: RecordApprovalDecisionInput): Promise<ApprovalStepApprover> {
  const approver = await findApproverById(input.stepApproverId)
  if (!approver) throw new Error("Approver record not found.")
  if (approver.approverEmployeeId !== input.actorEmployeeId) {
    throw new Error("Only the resolved approver for this step may record this decision.")
  }
  if (approver.decision !== "PENDING") {
    // Idempotent no-op: nothing new happened, so nothing new is published.
    return approver
  }

  let events: PendingEvent[] = []
  const result = await prisma.$transaction(async (tx) => {
    // Checked before recording the decision, not after: if the instance
    // was cancelled (or otherwise force-terminated this step) concurrently
    // with this call, the step is no longer ACTIVE even though this
    // approver's own decision row might still read PENDING — cancel only
    // touches step-instance status, never individual approver rows. Failing
    // here with a clear message avoids recording a decision only to roll
    // it back moments later with a confusing "please retry" (retrying
    // would hit the exact same wall, since the instance really is done).
    const stepInstanceBefore = await findStepInstanceById(approver.approvalStepInstanceId, tx)
    if (!stepInstanceBefore) throw new Error("Step instance not found.")
    if (stepInstanceBefore.status !== "ACTIVE") {
      throw new Error("This step is no longer active — the approval may have already concluded or been cancelled.")
    }

    const decided = await recordApproverDecisionRepo(input.stepApproverId, input.decision, input.comment ?? null, tx)
    if (!decided.updated || !decided.approver) {
      // Lost the race to a concurrent decider (or a concurrent retry) —
      // idempotent no-op, same as the up-front check above.
      const current = await findApproverById(input.stepApproverId, tx)
      return { approver: current!, events: [] as PendingEvent[] }
    }

    const stepInstance = stepInstanceBefore
    const stepDef = await findStepDefinitionById(stepInstance.stepDefinitionId, tx)
    if (!stepDef) throw new Error("Step definition not found.")
    const instance = await findApprovalInstanceById(stepInstance.approvalInstanceId, tx)
    if (!instance) throw new Error("Approval instance not found.")

    await recordApprovalActionTx(
      tx,
      instance.id,
      stepInstance.id,
      decisionToActionType(input.decision),
      input.actorEmployeeId,
      input.comment ?? null
    )

    const localEvents: PendingEvent[] = [
      {
        type:
          input.decision === "APPROVED"
            ? ApprovalEventType.ApprovalStepApproved
            : input.decision === "REJECTED"
              ? ApprovalEventType.ApprovalStepRejected
              : ApprovalEventType.ApprovalStepReturned,
        payload: {
          entityType: instance.entityType,
          entityId: instance.entityId,
          instanceId: instance.id,
          stepInstanceId: stepInstance.id,
          approverEmployeeId: input.actorEmployeeId,
        },
      },
    ]

    if (input.decision === "REJECTED" || input.decision === "RETURNED") {
      assertValidStepInstanceTransition(stepInstance.status, decisionToStepStatus(input.decision))
      const decidedStep = await updateStepInstanceStatusRepo(
        stepInstance.id,
        { fromStatus: "ACTIVE", toStatus: decisionToStepStatus(input.decision), decidedAt: new Date() },
        tx
      )
      if (!decidedStep.updated) throw new Error("Concurrent modification of the step — please retry.")

      if (!stepDef.isOptional) {
        // A required branch was rejected/returned — the whole instance
        // terminates now. Force-terminate any still-ACTIVE sibling
        // branches at the same stepOrder (parallel branches that hadn't
        // decided yet) so the invariant "no instance is terminal while a
        // step instance is still ACTIVE" always holds.
        const siblings = (await findStepInstancesByApprovalInstance(instance.id, tx)).filter(
          (si) => si.stepOrder === stepInstance.stepOrder && si.id !== stepInstance.id && si.status === "ACTIVE"
        )
        for (const sibling of siblings) {
          await updateStepInstanceStatusRepo(
            sibling.id,
            { fromStatus: "ACTIVE", toStatus: "SKIPPED", skipReason: "INSTANCE_TERMINATED" },
            tx
          )
        }

        assertValidInstanceTransition(instance.status, decisionToInstanceStatus(input.decision))
        const updatedInstance = await updateApprovalInstanceStatusRepo(
          instance.id,
          { fromStatus: instance.status, toStatus: decisionToInstanceStatus(input.decision), decidedAt: new Date() },
          tx
        )
        if (!updatedInstance.instance) throw new Error("Concurrent modification of the instance — please retry.")

        localEvents.push({
          type:
            input.decision === "REJECTED" ? ApprovalEventType.ApprovalInstanceRejected : ApprovalEventType.ApprovalInstanceReturned,
          payload: { entityType: instance.entityType, entityId: instance.entityId, instanceId: instance.id },
        })
        return { approver: decided.approver, events: localEvents }
      }

      // Optional branch — doesn't block the instance. Fall through to the
      // same "did this stepOrder finish" check as an approval would.
      const advance = await maybeAdvanceStepOrder(tx, instance, stepInstance.stepOrder)
      return { approver: decided.approver, events: [...localEvents, ...advance] }
    }

    // APPROVED — check whether this branch's quorum is now satisfied.
    const allApprovers = await findApproversByStepInstance(stepInstance.id, tx)
    const approvedCount = allApprovers.filter((a) => a.decision === "APPROVED").length
    const totalCount = allApprovers.length
    const quorumMet =
      stepDef.quorumMode === "ALL"
        ? approvedCount === totalCount
        : stepDef.quorumMode === "MAJORITY"
          ? approvedCount > totalCount / 2
          : approvedCount >= 1 // ANY_ONE

    if (!quorumMet) {
      // Still waiting on more approvers for this same branch.
      return { approver: decided.approver, events: localEvents }
    }

    assertValidStepInstanceTransition(stepInstance.status, "APPROVED")
    const decidedStep = await updateStepInstanceStatusRepo(
      stepInstance.id,
      { fromStatus: "ACTIVE", toStatus: "APPROVED", decidedAt: new Date() },
      tx
    )
    if (!decidedStep.updated) throw new Error("Concurrent modification of the step — please retry.")

    const advance = await maybeAdvanceStepOrder(tx, instance, stepInstance.stepOrder)
    return { approver: decided.approver, events: [...localEvents, ...advance] }
  })

  events = result.events
  await publishAll(events)
  return result.approver
}

/** Checks whether every branch at stepOrder has reached a terminal
 * step-instance status; if so, activates the next stepOrder (or finalizes
 * the instance). If other parallel branches at this stepOrder are still
 * ACTIVE, returns no events — the instance simply waits. */
async function maybeAdvanceStepOrder(
  tx: PrismaClientOrTransaction,
  instance: ApprovalInstance,
  stepOrder: number
): Promise<PendingEvent[]> {
  const stepInstancesAtOrder = (await findStepInstancesByApprovalInstance(instance.id, tx)).filter(
    (si) => si.stepOrder === stepOrder
  )
  const allDone = stepInstancesAtOrder.every((si) => isTerminalStepInstanceStatus(si.status))
  if (!allDone) return []

  // instance.status is already IN_REVIEW here — decide() only ever calls
  // this mid-flow, after the instance was already activated once.
  const activation = await activateFromStepOrder(tx, instance, stepOrder + 1, instance.contextPayload)
  return activation.events
}

// ---------------------------------------------------------------------------
// Cancel / Reopen / Viewed
// ---------------------------------------------------------------------------

export async function cancelApprovalInstance(
  instanceId: string,
  actorEmployeeId: string,
  comment?: string | null
): Promise<ApprovalInstance> {
  const instance = await findApprovalInstanceById(instanceId)
  if (!instance) throw new Error("Approval instance not found.")
  if (instance.status === "CANCELLED") {
    // Idempotent no-op: assertValidInstanceTransition treats "same status"
    // as structurally legal (that's needed elsewhere, e.g. multi-step
    // activation's IN_REVIEW -> IN_REVIEW advance), but a repeated cancel
    // request must not re-execute side effects — same discipline as
    // recordApprovalDecision's up-front PENDING check.
    return instance
  }
  assertValidInstanceTransition(instance.status, "CANCELLED")

  const result = await prisma.$transaction(async (tx) => {
    const updated = await updateApprovalInstanceStatusRepo(
      instanceId,
      { fromStatus: instance.status, toStatus: "CANCELLED", decidedAt: new Date() },
      tx
    )
    if (!updated.instance) throw new Error("Instance status changed concurrently — please retry.")

    const active = await findActiveStepInstances(instanceId, tx)
    for (const stepInstance of active) {
      await updateStepInstanceStatusRepo(
        stepInstance.id,
        { fromStatus: "ACTIVE", toStatus: "SKIPPED", skipReason: "INSTANCE_TERMINATED" },
        tx
      )
    }

    await recordApprovalActionTx(tx, instanceId, null, "CANCELLED", actorEmployeeId, comment ?? null)
    return updated.instance
  })

  await publishAll([
    {
      type: ApprovalEventType.ApprovalInstanceCancelled,
      payload: { entityType: instance.entityType, entityId: instance.entityId, instanceId: instance.id },
    },
  ])
  return result
}

/**
 * Only legal from REJECTED/RETURNED/CANCELLED/EXPIRED — never from
 * APPROVED/PARTIALLY_APPROVED (see the self-review's point 2 and
 * approval-state-machine.ts). Re-runs the same activation walk from
 * whichever stepOrder was current at the moment of termination, producing
 * a fresh round of step instances and approvers for that stepOrder
 * onward.
 */
export async function reopenApprovalInstance(
  instanceId: string,
  actorEmployeeId: string,
  comment?: string | null
): Promise<ApprovalInstance> {
  const instance = await findApprovalInstanceById(instanceId)
  if (!instance) throw new Error("Approval instance not found.")
  if (!REOPENABLE_INSTANCE_STATUSES.has(instance.status)) {
    // Deliberately not an idempotent no-op like cancel's — reopening
    // something that's already IN_REVIEW (or DRAFT/PENDING) is a caller
    // mistake, not a legitimate retry, so this must be a clear error
    // rather than silently doing nothing (see approval-state-machine.ts's
    // REOPENABLE_INSTANCE_STATUSES comment for why the generic
    // from===to shortcut isn't used here).
    throw new Error(`Cannot reopen an approval instance with status ${instance.status}.`)
  }
  assertValidInstanceTransition(instance.status, "IN_REVIEW")

  let events: PendingEvent[] = []
  const result = await prisma.$transaction(async (tx) => {
    const updated = await updateApprovalInstanceStatusRepo(
      instanceId,
      { fromStatus: instance.status, toStatus: "IN_REVIEW", decidedAt: null },
      tx
    )
    if (!updated.instance) throw new Error("Instance status changed concurrently — please retry.")

    await recordApprovalActionTx(tx, instanceId, null, "REOPENED", actorEmployeeId, comment ?? null)

    const activation = await activateFromStepOrder(tx, updated.instance, instance.currentStepOrder ?? 1, instance.contextPayload)
    events = [
      {
        type: ApprovalEventType.ApprovalInstanceReopened,
        payload: { entityType: instance.entityType, entityId: instance.entityId, instanceId: instance.id },
      },
      ...activation.events,
    ]
    return activation.instance
  })

  await publishAll(events)
  return result
}

/** Debounced — only the first view is recorded/audited; a retried or
 * repeated call is a silent no-op, not an error. No event is published for
 * Viewed (see the self-review: it's high-volume and informational, not a
 * state transition a Notification Engine would react to). */
export async function markApprovalViewed(stepApproverId: string, actorEmployeeId: string): Promise<void> {
  const approver = await findApproverById(stepApproverId)
  if (!approver) throw new Error("Approver record not found.")
  if (approver.approverEmployeeId !== actorEmployeeId) {
    throw new Error("Only the resolved approver for this step may mark it viewed.")
  }
  if (approver.viewedAt) return

  const stepInstance = await findStepInstanceById(approver.approvalStepInstanceId)
  if (!stepInstance) throw new Error("Step instance not found.")

  await prisma.$transaction(async (tx) => {
    await recordApproverViewedRepo(stepApproverId, tx)
    await recordApprovalActionTx(tx, stepInstance.approvalInstanceId, stepInstance.id, "VIEWED", actorEmployeeId)
  })
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface ApprovalInstanceDetail {
  instance: ApprovalInstance
  stepInstances: ApprovalStepInstance[]
  approversByStepInstanceId: Record<string, ApprovalStepApprover[]>
}

export async function getApprovalInstanceDetail(instanceId: string): Promise<ApprovalInstanceDetail> {
  const instance = await findApprovalInstanceById(instanceId)
  if (!instance) throw new Error("Approval instance not found.")
  const stepInstances = await findStepInstancesByApprovalInstance(instanceId)
  const approversByStepInstanceId: Record<string, ApprovalStepApprover[]> = {}
  for (const stepInstance of stepInstances) {
    approversByStepInstanceId[stepInstance.id] = await findApproversByStepInstance(stepInstance.id)
  }
  return { instance, stepInstances, approversByStepInstanceId }
}

export function getApprovalHistory(entityType: string, entityId: string): Promise<ApprovalInstance[]> {
  return findApprovalInstancesForEntity(entityType, entityId)
}

export function getApprovalActionsForInstance(instanceId: string): Promise<ApprovalAction[]> {
  return findActionsByApprovalInstance(instanceId)
}

export function getPendingApprovalsForEmployee(approverEmployeeId: string): Promise<ApprovalStepApprover[]> {
  return findPendingApprovalsForEmployeeRepo(approverEmployeeId)
}
