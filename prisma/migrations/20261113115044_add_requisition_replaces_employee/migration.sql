-- AlterTable
ALTER TABLE "job_requisitions" ADD COLUMN "replacesEmployeeId" TEXT;

-- CreateIndex
CREATE INDEX "job_requisitions_replacesEmployeeId_idx" ON "job_requisitions"("replacesEmployeeId");
