import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { ApprovalStepApproverModel } from "@/generated/prisma/models"
import type { ApprovalDecision } from "@/generated/prisma/enums"
import { NON_TERMINAL_INSTANCE_STATUSES } from "@/lib/approval/approval-state-machine"

export type { ApprovalStepApproverModel as ApprovalStepApprover }

/**
 * The resolved concrete approver(s) for one ApprovalStepInstance. This is
 * what "my pending approvals" queries hit. No resolution/delegation logic
 * here — that's the approver-resolution registry and delegation service.
 *
 * Every function accepts an optional PrismaClientOrTransaction for the
 * same reason as the sibling instance-side repositories.
 */
export interface ApprovalStepApproverInput {
  approvalStepInstanceId: string
  approverEmployeeId: string
  isDelegate?: boolean
  delegatedFromEmployeeId?: string | null
}

export function findApproversByStepInstance(
  approvalStepInstanceId: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalStepApproverModel[]> {
  return client.approvalStepApprover.findMany({
    where: { approvalStepInstanceId },
    orderBy: { createdAt: "asc" },
  })
}

export function findApproverById(
  id: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalStepApproverModel | null> {
  return client.approvalStepApprover.findUnique({ where: { id } })
}

/**
 * "Pending" for a human means all three: this approver's own decision is
 * still PENDING, the step they'd decide on is still ACTIVE (not moot), and
 * the parent instance hasn't already ended (cancelled/terminated) out from
 * under it. The original Phase 4A version of this query only checked the
 * first condition — found and fixed during the Phase 4C self-review: a
 * cancelled instance's still-PENDING approver rows would otherwise haunt
 * this list forever.
 */
export function findPendingApprovalsForEmployee(
  approverEmployeeId: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalStepApproverModel[]> {
  return client.approvalStepApprover.findMany({
    where: {
      approverEmployeeId,
      decision: "PENDING",
      approvalStepInstance: {
        status: "ACTIVE",
        approvalInstance: { status: { in: NON_TERMINAL_INSTANCE_STATUSES } },
      },
    },
    orderBy: { createdAt: "asc" },
  })
}

export function createStepApprover(
  input: ApprovalStepApproverInput,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalStepApproverModel> {
  return client.approvalStepApprover.create({
    data: {
      approvalStepInstanceId: input.approvalStepInstanceId,
      approverEmployeeId: input.approverEmployeeId,
      isDelegate: input.isDelegate ?? false,
      delegatedFromEmployeeId: input.delegatedFromEmployeeId ?? null,
    },
  })
}

/**
 * A conditional UPDATE ... WHERE decision = 'PENDING' — the core
 * concurrency-safety and idempotency primitive for the whole engine (see
 * the Phase 4C self-review's points 3 and 5). updated:false means someone
 * else (a retry, or a concurrent decider) already recorded a decision on
 * this row; the caller treats that as an idempotent no-op rather than an
 * error, UNLESS the retried decision value itself differs from what's
 * already stored, which the caller checks by comparing against the
 * returned (unchanged) approver row.
 */
export async function recordApproverDecision(
  id: string,
  decision: ApprovalDecision,
  comment: string | null,
  client: PrismaClientOrTransaction = prisma
): Promise<{ updated: boolean; approver: ApprovalStepApproverModel | null }> {
  const result = await client.approvalStepApprover.updateMany({
    where: { id, decision: "PENDING" },
    data: { decision, decidedAt: new Date(), comment },
  })

  if (result.count === 0) return { updated: false, approver: null }
  const approver = await client.approvalStepApprover.findUnique({ where: { id } })
  return { updated: true, approver }
}

/** Debounced at the service layer (only the first view is recorded) —
 * this repository function itself is unconditional since "viewedAt is
 * already set" is what the service checks beforehand. */
export function recordApproverViewed(
  id: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalStepApproverModel> {
  return client.approvalStepApprover.update({ where: { id }, data: { viewedAt: new Date() } })
}
