-- CreateTable
CREATE TABLE "auth_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "employeeId" TEXT,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "auth_users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "auth_roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystemRole" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "auth_permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "auth_role_permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "auth_role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "auth_roles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "auth_role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "auth_permissions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "auth_user_role_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'GLOBAL',
    "scopeId" TEXT,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "auth_user_role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "auth_user_role_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "auth_roles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "auth_user_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "auth_user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "auth_password_reset_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "auth_audit_log_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_employeeId_key" ON "auth_users"("employeeId");

-- CreateIndex
CREATE INDEX "auth_users_employeeId_idx" ON "auth_users"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_roles_key_key" ON "auth_roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "auth_permissions_key_key" ON "auth_permissions"("key");

-- CreateIndex
CREATE INDEX "auth_role_permissions_permissionId_idx" ON "auth_role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_role_permissions_roleId_permissionId_key" ON "auth_role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "auth_user_role_assignments_userId_idx" ON "auth_user_role_assignments"("userId");

-- CreateIndex
CREATE INDEX "auth_user_role_assignments_roleId_idx" ON "auth_user_role_assignments"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_user_sessions_jti_key" ON "auth_user_sessions"("jti");

-- CreateIndex
CREATE INDEX "auth_user_sessions_userId_idx" ON "auth_user_sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_password_reset_tokens_tokenHash_key" ON "auth_password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_password_reset_tokens_userId_idx" ON "auth_password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "auth_audit_log_entries_actorUserId_idx" ON "auth_audit_log_entries"("actorUserId");

-- CreateIndex
CREATE INDEX "auth_audit_log_entries_action_timestamp_idx" ON "auth_audit_log_entries"("action", "timestamp");
