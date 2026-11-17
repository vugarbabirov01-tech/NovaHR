-- CreateTable
CREATE TABLE "disciplinary_actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "issuedDate" TEXT NOT NULL,
    "violationDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "basis" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "disciplinary_actions_employeeId_issuedDate_idx" ON "disciplinary_actions"("employeeId", "issuedDate");
