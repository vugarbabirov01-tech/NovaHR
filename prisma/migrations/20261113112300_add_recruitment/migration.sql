-- CreateTable
CREATE TABLE "job_requisitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" TEXT,
    "branchId" TEXT,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "salaryMin" REAL,
    "salaryMax" REAL,
    "reason" TEXT NOT NULL DEFAULT 'NEW_POSITION',
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "recruitment_status_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requisitionId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "actor" TEXT NOT NULL DEFAULT 'system',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "finCode" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'OTHER',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "recruitment_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "rejectionReason" TEXT NOT NULL DEFAULT '',
    "stageUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recruitment_applications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recruitment_applications_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "job_requisitions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recruitment_application_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NOTE',
    "text" TEXT NOT NULL,
    "rating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recruitment_application_notes_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruitment_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "job_requisitions_code_key" ON "job_requisitions"("code");

-- CreateIndex
CREATE INDEX "job_requisitions_status_idx" ON "job_requisitions"("status");

-- CreateIndex
CREATE INDEX "recruitment_status_events_requisitionId_idx" ON "recruitment_status_events"("requisitionId");

-- CreateIndex
CREATE INDEX "candidates_finCode_idx" ON "candidates"("finCode");

-- CreateIndex
CREATE INDEX "candidates_phone_idx" ON "candidates"("phone");

-- CreateIndex
CREATE INDEX "candidates_email_idx" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "recruitment_applications_requisitionId_stage_idx" ON "recruitment_applications"("requisitionId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_applications_candidateId_requisitionId_key" ON "recruitment_applications"("candidateId", "requisitionId");

-- CreateIndex
CREATE INDEX "recruitment_application_notes_applicationId_idx" ON "recruitment_application_notes"("applicationId");
