import { PrismaLibSql } from "@prisma/adapter-libsql"

import { Prisma, PrismaClient } from "@/generated/prisma/client"

/** What a repository function accepts when it needs to participate in a
 * caller-managed transaction — the interactive-transaction callback's `tx`
 * parameter shares this same shape as the top-level `prisma` client
 * (query methods only, no nested $transaction/$connect/$disconnect), so a
 * repository function typed against this can be called identically inside
 * or outside a transaction. First needed by the Approval Engine (Phase
 * 4C), which is the first part of this codebase composing writes across
 * more than one repository inside a single atomic transaction. */
export type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient

// SQLite (via libSQL) locally, hosted libSQL (Turso) in production —
// `authToken` is simply ignored for a local `file:` URL. To move to
// PostgreSQL later, swap this adapter for `@prisma/adapter-pg`, point
// DATABASE_URL at the Postgres connection string, change the datasource
// provider in schema.prisma, and run `prisma migrate dev` — every
// repository in src/repositories/ keeps working unchanged, since they only
// depend on the Prisma Client API.
const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
})

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
