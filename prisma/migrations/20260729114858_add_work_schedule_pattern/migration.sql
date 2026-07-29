-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_work_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scheduleType" TEXT NOT NULL DEFAULT 'WEEKLY',
    "workingDays" TEXT NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI',
    "rotationOnDays" INTEGER,
    "rotationOffDays" INTEGER,
    "rotationStartDate" DATETIME
);
INSERT INTO "new_work_schedules" ("active", "code", "createdAt", "description", "id", "label", "updatedAt") SELECT "active", "code", "createdAt", "description", "id", "label", "updatedAt" FROM "work_schedules";
DROP TABLE "work_schedules";
ALTER TABLE "new_work_schedules" RENAME TO "work_schedules";
CREATE UNIQUE INDEX "work_schedules_code_key" ON "work_schedules"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
