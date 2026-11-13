-- AlterTable
ALTER TABLE "recruitment_applications" ADD COLUMN "hiredEmployeeId" TEXT;

-- CreateTable
CREATE TABLE "recruitment_offers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "salary" REAL NOT NULL,
    "startDate" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sentAt" DATETIME,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "recruitment_offers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruitment_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_offers_applicationId_key" ON "recruitment_offers"("applicationId");
