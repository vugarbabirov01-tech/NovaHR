-- AlterTable
ALTER TABLE "auth_user_role_assignments" ADD COLUMN "activeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "auth_user_role_assignments_activeKey_key" ON "auth_user_role_assignments"("activeKey");
