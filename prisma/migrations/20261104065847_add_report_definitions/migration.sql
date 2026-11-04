-- CreateTable
CREATE TABLE "report_definitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dataSource" TEXT NOT NULL DEFAULT 'EMPLOYEES',
    "columns" JSONB NOT NULL,
    "filters" JSONB NOT NULL,
    "sortBy" TEXT,
    "sortDirection" TEXT NOT NULL DEFAULT 'asc',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
