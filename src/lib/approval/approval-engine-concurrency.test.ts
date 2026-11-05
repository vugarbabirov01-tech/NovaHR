import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { prisma } from "@/lib/prisma"
import { createWorkflowDefinition } from "@/repositories/approval-workflow-definition-repository"
import { createWorkflowVersion, publishWorkflowVersion } from "@/repositories/approval-workflow-version-repository"
import { createStepDefinition } from "@/repositories/approval-step-definition-repository"
import { registerApproverResolver } from "@/lib/approval/approval-approver-resolver-registry"
import { submitForApproval } from "@/lib/approval/approval-engine-service"

/**
 * Regression test for the activeKey-conflict-detection fix (2026-11-05):
 * isActiveKeyConflict used to check only `meta.target`, which this
 * project's actual datasource (SQLite via the libSQL driver adapter)
 * never populates for a P2002 — meaning a genuine concurrent double-
 * submission race here surfaced as an UNHANDLED error instead of
 * submitForApproval's own already-documented behavior ("the race loser
 * gets the winner's instance back"). No existing test exercised this
 * path at all before this file.
 *
 * Uses a synthetic entityType/entityId (never a real LeaveRequest or any
 * other real business entity) and a disposable workflow definition/
 * version/step created and removed by this file alone — touches no real
 * leave data, per the explicit instruction. Registers a trivial
 * SPECIFIC_EMPLOYEE resolver for the duration of this suite (the registry
 * has none registered by default anywhere in the running app yet) that
 * resolves to zero approvers; skipIfNoApproverResolved lets the step
 * clear without needing any real employee to exist.
 */
describe("Approval Engine — concurrent submission race", () => {
  const ENTITY_TYPE = "TEST_CONCURRENCY_ENTITY"
  const ENTITY_ID = `test-concurrency-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  let workflowDefinitionId: string
  let workflowVersionId: string

  beforeAll(async () => {
    // Resolves to one fake (never-real) approver id — deliberately NOT
    // zero: this engine's state machine does not accept a direct
    // PENDING -> PARTIALLY_APPROVED transition for an immediately-fully-
    // skipped single-step workflow (found while writing this test; a
    // separate, pre-existing gap, out of this fix's scope). Resolving to
    // one approver instead keeps the instance in a normal PENDING/
    // IN_REVIEW state — this test only needs the instance to be CREATED
    // exactly once, not to ever actually get decided.
    registerApproverResolver("SPECIFIC_EMPLOYEE", () => ["TEST-APPROVER-NEVER-REAL"])

    const definition = await createWorkflowDefinition({
      code: `TEST-CONCURRENCY-${ENTITY_ID}`,
      name: "Test concurrency workflow",
      entityType: ENTITY_TYPE,
      createdBy: "TEST",
    })
    workflowDefinitionId = definition.id

    const version = await createWorkflowVersion({
      workflowDefinitionId: definition.id,
      version: 1,
      createdBy: "TEST",
    })
    workflowVersionId = version.id

    await createStepDefinition({
      workflowVersionId: version.id,
      stepOrder: 1,
      name: "Step 1",
      approverResolutionType: "SPECIFIC_EMPLOYEE",
      skipIfNoApproverResolved: true,
    })

    await publishWorkflowVersion(version.id, "TEST")
  })

  afterAll(async () => {
    // No repository delete function exists for these Phase 4 models yet
    // (only archive) — a direct, test-scoped cleanup of exactly the rows
    // this suite created, never touching any other row.
    await prisma.approvalAction.deleteMany({ where: { approvalInstance: { entityType: ENTITY_TYPE, entityId: ENTITY_ID } } })
    await prisma.approvalStepApprover.deleteMany({ where: { approvalStepInstance: { approvalInstance: { entityType: ENTITY_TYPE, entityId: ENTITY_ID } } } })
    await prisma.approvalStepInstance.deleteMany({ where: { approvalInstance: { entityType: ENTITY_TYPE, entityId: ENTITY_ID } } })
    await prisma.approvalInstance.deleteMany({ where: { entityType: ENTITY_TYPE, entityId: ENTITY_ID } })
    await prisma.approvalStepDefinition.deleteMany({ where: { workflowVersionId } })
    await prisma.approvalWorkflowVersion.deleteMany({ where: { id: workflowVersionId } })
    await prisma.approvalWorkflowDefinition.deleteMany({ where: { id: workflowDefinitionId } })
  })

  it("resolves 5 fully parallel submitForApproval calls for the same entity to exactly one instance", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        submitForApproval({
          entityType: ENTITY_TYPE,
          entityId: ENTITY_ID,
          contextPayload: {},
          submittedBy: "TEST",
        })
      )
    )

    const uniqueIds = new Set(results.map((instance) => instance.id))
    expect(uniqueIds.size).toBe(1)

    const rows = await prisma.approvalInstance.findMany({ where: { entityType: ENTITY_TYPE, entityId: ENTITY_ID } })
    expect(rows).toHaveLength(1)
  })
})
