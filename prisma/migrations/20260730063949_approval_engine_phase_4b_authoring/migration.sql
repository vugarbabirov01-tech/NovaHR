-- AlterTable
ALTER TABLE "approval_workflow_versions" ADD COLUMN "canvasMetadata" JSONB;

-- CreateTable
CREATE TABLE "approval_workflow_audit_log_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_approval_step_definitions" (
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
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "slaHours" INTEGER,
    "uiMetadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_step_definitions_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "approval_workflow_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_approval_step_definitions" ("approverResolutionConfig", "approverResolutionType", "branchKey", "conditionExpression", "createdAt", "id", "name", "quorumMode", "skipIfNoApproverResolved", "slaHours", "stepOrder", "workflowVersionId") SELECT "approverResolutionConfig", "approverResolutionType", "branchKey", "conditionExpression", "createdAt", "id", "name", "quorumMode", "skipIfNoApproverResolved", "slaHours", "stepOrder", "workflowVersionId" FROM "approval_step_definitions";
DROP TABLE "approval_step_definitions";
ALTER TABLE "new_approval_step_definitions" RENAME TO "approval_step_definitions";
CREATE INDEX "approval_step_definitions_workflowVersionId_idx" ON "approval_step_definitions"("workflowVersionId");
CREATE UNIQUE INDEX "approval_step_definitions_workflowVersionId_stepOrder_branchKey_key" ON "approval_step_definitions"("workflowVersionId", "stepOrder", "branchKey");
CREATE TABLE "new_approval_workflow_definitions" (
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
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_approval_workflow_definitions" ("active", "branchId", "code", "companyId", "conditionExpression", "createdAt", "createdBy", "departmentId", "description", "entityType", "id", "name", "priority", "updatedAt") SELECT "active", "branchId", "code", "companyId", "conditionExpression", "createdAt", "createdBy", "departmentId", "description", "entityType", "id", "name", "priority", "updatedAt" FROM "approval_workflow_definitions";
DROP TABLE "approval_workflow_definitions";
ALTER TABLE "new_approval_workflow_definitions" RENAME TO "approval_workflow_definitions";
CREATE UNIQUE INDEX "approval_workflow_definitions_code_key" ON "approval_workflow_definitions"("code");
CREATE INDEX "approval_workflow_definitions_entityType_idx" ON "approval_workflow_definitions"("entityType");
CREATE INDEX "approval_workflow_definitions_companyId_idx" ON "approval_workflow_definitions"("companyId");
CREATE INDEX "approval_workflow_definitions_branchId_idx" ON "approval_workflow_definitions"("branchId");
CREATE INDEX "approval_workflow_definitions_departmentId_idx" ON "approval_workflow_definitions"("departmentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "approval_workflow_audit_log_entries_entityType_entityId_idx" ON "approval_workflow_audit_log_entries"("entityType", "entityId");
