// Test-only helper — NOT imported by any application code, only by
// Authentication test files. UserRoleAssignment.activeKey's own migration
// (see the Phase A follow-up report) is a proposed preview, not yet
// applied to the real dev.db, so any test that writes a UserRoleAssignment
// (which always sets activeKey) cannot run against the shared real
// database the rest of this project's tests use. This builds a brand-new,
// empty, disposable SQLite file instead — `prisma migrate deploy` applies
// every migration INCLUDING the pending activeKey one to that file only,
// via a DATABASE_URL override scoped to the one child process invocation,
// never touching the real dev.db's own DATABASE_URL or its 12 applied
// migrations. The file is deleted when the caller's test run finishes.

import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "@/generated/prisma/client"

export interface AuthSandbox {
  client: PrismaClient
  cleanup: () => Promise<void>
}

export function createAuthTestSandbox(): AuthSandbox {
  const dir = mkdtempSync(path.join(tmpdir(), "novahr-auth-sandbox-"))
  const dbPath = path.join(dir, "sandbox.db")
  const databaseUrl = `file:${dbPath}`

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
    shell: true,
  })

  const client = new PrismaClient({ adapter: new PrismaLibSql({ url: databaseUrl }) })

  return {
    client,
    cleanup: async () => {
      await client.$disconnect()
      // The libSQL native binding can hold the sqlite file handle open on
      // Windows for a bit even after $disconnect() resolves — retry, but
      // never fail the whole test RUN over a leftover temp file: it's
      // under the OS temp directory (never inside the project, never
      // real data, never committed), so a stuck handle just means one
      // extra file sits in %TEMP% until the OS reclaims it.
      for (let attempt = 1; attempt <= 10; attempt++) {
        try {
          rmSync(dir, { recursive: true, force: true })
          return
        } catch (error) {
          if (attempt === 10) {
            console.warn(`createAuthTestSandbox: could not remove temp dir "${dir}" (non-fatal):`, error)
            return
          }
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
      }
    },
  }
}
