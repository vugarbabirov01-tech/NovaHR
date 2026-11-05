// Authentication Phase A — bootstrap the first Super Admin. PREPARED,
// NOT EXECUTED (see the Phase A follow-up report) — this creates a real
// User row with real login credentials, which needs its own explicit
// go-ahead separate from everything else in this phase.
//
// Must be run from a real server/shell session — this is a plain Node
// script, never reachable over HTTP, by design (no Server Action, no API
// route does what this does).
//
// Normal bootstrap (no Super Admin exists yet):
//   npx tsx scripts/bootstrap-super-admin.ts --email=admin@novahr.local --full-name="Ada Min"
//
// Recovery (a Super Admin already exists — lost credentials, compromised
// account, or a deliberate SECOND Super Admin is genuinely intended):
//   BOOTSTRAP_RECOVERY_SECRET=<value only the operator running this knows>
//     npx tsx scripts/bootstrap-super-admin.ts --email=... --full-name="..." --force
//
// --force alone does nothing — it is REQUIRED alongside
// BOOTSTRAP_RECOVERY_SECRET (an env var, never a CLI flag, so it never
// lands in shell history or a process list), not a substitute for it.
// BOOTSTRAP_RECOVERY_SECRET is never written anywhere by this script,
// never logged, and is not checked against a stored value — being able to
// set it at all (server/env access) IS the authorization, same posture as
// this project's other server-only secrets (AUTH_SECRET,
// ATTENDANCE_QR_*_PASSWORD).
//
// The generated password is printed to STDOUT exactly once and nowhere
// else — never to a file, never to console.error, never included in any
// AuthAuditLogEntry.metadata. Whoever runs this must relay it to the real
// admin out of band (do not redirect this script's output to a log file).

import { randomBytes } from "node:crypto"

import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth/password-hash"
import { createUser, findUserByEmail } from "@/repositories/user-repository"
import { findRoleByKey } from "@/repositories/role-repository"
import { findActiveAssignmentsForUser } from "@/repositories/user-role-assignment-repository"
import { createUserRoleAssignmentForRole } from "@/lib/auth/user-role-assignment-service"
import { AuthAuditAction, recordAuthAudit } from "@/lib/auth/auth-audit"

const SUPER_ADMIN_SELF_ASSIGNED_BY = "BOOTSTRAP_SCRIPT"

interface CliArgs {
  email?: string
  fullName?: string
  force: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { force: false }
  for (const raw of argv) {
    if (raw === "--force") args.force = true
    else if (raw.startsWith("--email=")) args.email = raw.slice("--email=".length)
    else if (raw.startsWith("--full-name=")) args.fullName = raw.slice("--full-name=".length)
  }
  return args
}

/** 24 random bytes, base64url-encoded — well above any reasonable
 * temporary-password entropy bar, and mustChangePassword forces it to be
 * replaced on first login regardless. */
function generateTemporaryPassword(): string {
  return randomBytes(24).toString("base64url")
}

async function countActiveSuperAdminAssignments(): Promise<number> {
  const superAdminRole = await findRoleByKey("SUPER_ADMIN")
  if (!superAdminRole) return 0 // role itself not seeded yet — nothing to count
  const rows = await prisma.userRoleAssignment.findMany({
    where: { roleId: superAdminRole.id, revokedAt: null },
    select: { id: true },
  })
  return rows.length
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.email || !args.fullName) {
    console.error('Usage: --email=<email> --full-name="<name>" [--force]')
    process.exitCode = 1
    return
  }

  const existingSuperAdminCount = await countActiveSuperAdminAssignments()
  const isRecoveryPath = existingSuperAdminCount > 0

  if (isRecoveryPath) {
    const recoverySecret = process.env.BOOTSTRAP_RECOVERY_SECRET
    if (!args.force || !recoverySecret) {
      console.error(
        `Refusing: ${existingSuperAdminCount} active Super Admin assignment(s) already exist. ` +
          "A second one requires BOTH --force AND the BOOTSTRAP_RECOVERY_SECRET environment variable set " +
          "(never as a CLI argument). This is deliberate — see this script's own header comment."
      )
      process.exitCode = 1
      return
    }
  }

  const existingUser = await findUserByEmail(args.email)
  if (existingUser) {
    const activeAssignments = await findActiveAssignmentsForUser(existingUser.id)
    if (activeAssignments.length > 0) {
      console.error(`Refusing: a User already exists for "${args.email}" with active role assignment(s).`)
      process.exitCode = 1
      return
    }
  }

  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await hashPassword(temporaryPassword)

  const user =
    existingUser ??
    (await createUser({
      email: args.email,
      passwordHash,
      fullName: args.fullName,
      mustChangePassword: true,
    }))

  await createUserRoleAssignmentForRole({
    userId: user.id,
    roleKey: "SUPER_ADMIN",
    scopeType: "GLOBAL",
    scopeId: null,
    assignedBy: SUPER_ADMIN_SELF_ASSIGNED_BY,
  })

  await recordAuthAudit({
    actorUserId: null,
    action: isRecoveryPath ? AuthAuditAction.BootstrapSuperAdminRecoveryExecuted : AuthAuditAction.BootstrapSuperAdminCreated,
    targetType: "User",
    targetId: user.id,
    metadata: { email: args.email, recovery: isRecoveryPath },
  })

  // The ONLY place the temporary password is ever written. Do not pipe
  // this script's stdout to a file.
  console.log("")
  console.log("=".repeat(72))
  console.log(`Super Admin ${isRecoveryPath ? "recovery" : "bootstrap"} complete.`)
  console.log(`  Email:             ${args.email}`)
  console.log(`  Temporary password: ${temporaryPassword}`)
  console.log("  This password is shown ONCE and is not recoverable afterward.")
  console.log("  Relay it to the real administrator out of band now. A password")
  console.log("  change is required on first login (mustChangePassword=true).")
  console.log("=".repeat(72))
}

main()
  .catch((error) => {
    console.error("Bootstrap failed:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
