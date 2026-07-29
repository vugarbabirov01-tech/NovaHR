-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "category" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "immutable" BOOLEAN NOT NULL DEFAULT false
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_leave_policies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leaveTypeId" TEXT NOT NULL,
    "companyId" TEXT,
    "branchId" TEXT,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "entitlementUnitsPerYear" REAL,
    "accrualMethod" TEXT NOT NULL DEFAULT 'NONE',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "carryForwardAllowed" BOOLEAN NOT NULL DEFAULT false,
    "carryForwardMaxUnits" REAL,
    "carryForwardExpiryMonths" INTEGER,
    "encashmentAllowed" BOOLEAN NOT NULL DEFAULT false,
    "balanceValidationMode" TEXT NOT NULL DEFAULT 'WARN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "leave_policies_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "leave_policies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "leave_policies_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_leave_policies" ("accrualMethod", "active", "branchId", "carryForwardAllowed", "carryForwardExpiryMonths", "carryForwardMaxUnits", "companyId", "createdAt", "effectiveFrom", "effectiveTo", "encashmentAllowed", "entitlementUnitsPerYear", "id", "leaveTypeId", "requiresApproval", "updatedAt") SELECT "accrualMethod", "active", "branchId", "carryForwardAllowed", "carryForwardExpiryMonths", "carryForwardMaxUnits", "companyId", "createdAt", "effectiveFrom", "effectiveTo", "encashmentAllowed", "entitlementUnitsPerYear", "id", "leaveTypeId", "requiresApproval", "updatedAt" FROM "leave_policies";
DROP TABLE "leave_policies";
ALTER TABLE "new_leave_policies" RENAME TO "leave_policies";
CREATE INDEX "leave_policies_leaveTypeId_idx" ON "leave_policies"("leaveTypeId");
CREATE INDEX "leave_policies_companyId_idx" ON "leave_policies"("companyId");
CREATE INDEX "leave_policies_branchId_idx" ON "leave_policies"("branchId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "documents_entityType_entityId_idx" ON "documents"("entityType", "entityId");
