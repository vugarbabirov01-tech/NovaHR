import { PrismaLibSql } from "@prisma/adapter-libsql"

import { PrismaClient } from "@/generated/prisma/client"

// SQLite (via libSQL) locally. To move to PostgreSQL later, swap this
// adapter for `@prisma/adapter-pg`, point DATABASE_URL at the Postgres
// connection string, change the datasource provider in schema.prisma, and
// run `prisma migrate dev` — every repository in src/repositories/ keeps
// working unchanged, since they only depend on the Prisma Client API.
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" })

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
