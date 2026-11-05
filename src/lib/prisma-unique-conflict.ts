import { Prisma } from "@/generated/prisma/client"

/**
 * Detects a P2002 (unique constraint violation) on a specific field,
 * across the two `meta` shapes this codebase has actually observed:
 *  - the classic shape, `meta.target: string[]` (native/Postgres-style
 *    connectors), and
 *  - the libSQL driver adapter's own nested shape,
 *    `meta.driverAdapterError.cause.constraint.fields: string[]` —
 *    confirmed by provoking a real collision against this project's
 *    actual datasource (SQLite via @prisma/adapter-libsql); the plain
 *    `target`-only check used to miss this entirely, so a genuine
 *    concurrent-duplicate race surfaced as an unhandled error instead of
 *    the intended "the race loser gets the winner's row back" behavior.
 *
 * Checks the named field specifically — a P2002 on some OTHER unique
 * constraint (e.g. a plain id collision, or an unrelated unique column)
 * must never be mistaken for this one, so both branches require
 * `fields.includes(fieldName)`, never just "was it a P2002".
 */
export function isUniqueConstraintConflictOn(error: unknown, fieldName: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false

  const meta = error.meta as
    | { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } }
    | undefined

  if (Array.isArray(meta?.target)) return (meta.target as unknown[]).includes(fieldName)

  const driverFields = meta?.driverAdapterError?.cause?.constraint?.fields
  if (Array.isArray(driverFields)) return (driverFields as unknown[]).includes(fieldName)

  return false
}
