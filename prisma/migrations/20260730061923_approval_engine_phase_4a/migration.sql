-- CreateTable
CREATE TABLE "approval_workflow_definitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT NOT NULL,
    "companyId" TEXT,
    "branchId" TEXT,
    "departmentId" TEXT,
    "conditionExpression" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "approval_workflow_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowDefinitionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "defaultSlaHours" INTEGER,
    "publishedBy" TEXT,
    "publishedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_workflow_versions_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "approval_workflow_definitions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approval_step_definitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowVersionId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "branchKey" TEXT NOT NULL DEFAULT 'DEFAULT',
    "name" TEXT NOT NULL,
    "approverResolutionType" TEXT NOT NULL,
    "approverResolutionConfig" JSONB,
    "quorumMode" TEXT NOT NULL DEFAULT 'ANY_ONE',
    "conditionExpression" JSONB,
    "skipIfNoApproverResolved" BOOLEAN NOT NULL DEFAULT false,
    "slaHours" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_step_definitions_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "approval_workflow_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approval_instances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "workflowDefinitionId" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentStepOrder" INTEGER,
    "contextPayload" JSONB NOT NULL,
    "companyId" TEXT,
    "branchId" TEXT,
    "departmentId" TEXT,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "approval_instances_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "approval_workflow_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approval_step_instances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "approvalInstanceId" TEXT NOT NULL,
    "stepDefinitionId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "branchKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "activatedAt" DATETIME,
    "dueAt" DATETIME,
    "decidedAt" DATETIME,
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_step_instances_approvalInstanceId_fkey" FOREIGN KEY ("approvalInstanceId") REFERENCES "approval_instances" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "approval_step_instances_stepDefinitionId_fkey" FOREIGN KEY ("stepDefinitionId") REFERENCES "approval_step_definitions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approval_step_approvers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "approvalStepInstanceId" TEXT NOT NULL,
    "approverEmployeeId" TEXT NOT NULL,
    "isDelegate" BOOLEAN NOT NULL DEFAULT false,
    "delegatedFromEmployeeId" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" DATETIME,
    "comment" TEXT,
    "viewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_step_approvers_approvalStepInstanceId_fkey" FOREIGN KEY ("approvalStepInstanceId") REFERENCES "approval_step_instances" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approval_actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "approvalInstanceId" TEXT NOT NULL,
    "approvalStepInstanceId" TEXT,
    "actionType" TEXT NOT NULL,
    "actorEmployeeId" TEXT NOT NULL,
    "comment" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_actions_approvalInstanceId_fkey" FOREIGN KEY ("approvalInstanceId") REFERENCES "approval_instances" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approval_delegations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "delegatorEmployeeId" TEXT NOT NULL,
    "delegateEmployeeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "scopeEntityType" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_definitions_code_key" ON "approval_workflow_definitions"("code");

-- CreateIndex
CREATE INDEX "approval_workflow_definitions_entityType_idx" ON "approval_workflow_definitions"("entityType");

-- CreateIndex
CREATE INDEX "approval_workflow_definitions_companyId_idx" ON "approval_workflow_definitions"("companyId");

-- CreateIndex
CREATE INDEX "approval_workflow_definitions_branchId_idx" ON "approval_workflow_definitions"("branchId");

-- CreateIndex
CREATE INDEX "approval_workflow_definitions_departmentId_idx" ON "approval_workflow_definitions"("departmentId");

-- CreateIndex
CREATE INDEX "approval_workflow_versions_workflowDefinitionId_idx" ON "approval_workflow_versions"("workflowDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_versions_workflowDefinitionId_version_key" ON "approval_workflow_versions"("workflowDefinitionId", "version");

-- CreateIndex
CREATE INDEX "approval_step_definitions_workflowVersionId_idx" ON "approval_step_definitions"("workflowVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_step_definitions_workflowVersionId_stepOrder_branchKey_key" ON "approval_step_definitions"("workflowVersionId", "stepOrder", "branchKey");

-- CreateIndex
CREATE INDEX "approval_instances_entityType_entityId_idx" ON "approval_instances"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "approval_instances_companyId_idx" ON "approval_instances"("companyId");

-- CreateIndex
CREATE INDEX "approval_instances_status_idx" ON "approval_instances"("status");

-- CreateIndex
CREATE INDEX "approval_step_instances_approvalInstanceId_idx" ON "approval_step_instances"("approvalInstanceId");

-- CreateIndex
CREATE INDEX "approval_step_instances_status_dueAt_idx" ON "approval_step_instances"("status", "dueAt");

-- CreateIndex
CREATE INDEX "approval_step_approvers_approverEmployeeId_decision_idx" ON "approval_step_approvers"("approverEmployeeId", "decision");

-- CreateIndex
CREATE INDEX "approval_step_approvers_approvalStepInstanceId_idx" ON "approval_step_approvers"("approvalStepInstanceId");

-- CreateIndex
CREATE INDEX "approval_actions_approvalInstanceId_idx" ON "approval_actions"("approvalInstanceId");

-- CreateIndex
CREATE INDEX "approval_actions_actorEmployeeId_idx" ON "approval_actions"("actorEmployeeId");

-- CreateIndex
CREATE INDEX "approval_delegations_delegatorEmployeeId_active_idx" ON "approval_delegations"("delegatorEmployeeId", "active");
