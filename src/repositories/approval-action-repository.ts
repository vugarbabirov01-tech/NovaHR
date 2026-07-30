import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { ApprovalActionModel } from "@/generated/prisma/models"
import type { ApprovalActionType } from "@/generated/prisma/enums"

export type { ApprovalActionModel as ApprovalAction }

/**
 * The engine's own append-only action log — the audit trail required by
 * the architecture (Created/Viewed/Approved/Rejected/Returned/Cancelled/
 * Delegated/Escalated/Reopened). No update/delete export on purpose, same
 * discipline as leave-audit-log-repository.ts: an audit trail that can be
 * edited isn't one. Written to via approval-engine-service.ts's own
 * recordApprovalAction() helper, always inside the same transaction as the
 * state change it records — see the Phase 4C self-review's point 7.
 *
 * Accepts an optional PrismaClientOrTransaction for the same reason as the
 * sibling instance-side repositories.
 */
export interface ApprovalActionInput {
  approvalInstanceId: string
  approvalStepInstanceId?: string | null
  actionType: ApprovalActionType
  actorEmployeeId: string
  comment?: string | null
  metadata?: Prisma.InputJsonValue | null
}

export function findActionsByApprovalInstance(
  approvalInstanceId: string,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalActionModel[]> {
  return client.approvalAction.findMany({
    where: { approvalInstanceId },
    orderBy: { createdAt: "desc" },
  })
}

export function createApprovalAction(
  input: ApprovalActionInput,
  client: PrismaClientOrTransaction = prisma
): Promise<ApprovalActionModel> {
  return client.approvalAction.create({
    data: {
      approvalInstanceId: input.approvalInstanceId,
      approvalStepInstanceId: input.approvalStepInstanceId ?? null,
      actionType: input.actionType,
      actorEmployeeId: input.actorEmployeeId,
      comment: input.comment ?? null,
      metadata:
        input.metadata === undefined
          ? undefined
          : input.metadata === null
            ? Prisma.NullableJsonNullValueInput.JsonNull
            : input.metadata,
    },
  })
}
