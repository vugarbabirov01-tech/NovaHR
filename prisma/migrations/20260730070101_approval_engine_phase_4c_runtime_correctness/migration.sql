-- AlterTable
ALTER TABLE "approval_instances" ADD COLUMN "activeKey" TEXT;

-- AlterTable
ALTER TABLE "approval_step_instances" ADD COLUMN "skipReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "approval_instances_activeKey_key" ON "approval_instances"("activeKey");
