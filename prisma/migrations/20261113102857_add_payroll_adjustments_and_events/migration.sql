-- AlterTable
ALTER TABLE "report_definitions" ADD COLUMN "pivotConfig" JSONB;

-- CreateTable
CREATE TABLE "payroll_adjustments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "payroll_period_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payrollPeriodId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "payroll_adjustments_recordId_idx" ON "payroll_adjustments"("recordId");

-- CreateIndex
CREATE INDEX "payroll_period_events_payrollPeriodId_idx" ON "payroll_period_events"("payrollPeriodId");
