import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { EmployeeProfile } from "@/types/employee-profile"

/**
 * The Employee module's real persistence — was purely in-memory
 * (src/data/employee-directory.ts, reset on every dev-server restart)
 * until the `Employee` Prisma model. Every function here mirrors the old
 * in-memory module's names/shapes as closely as possible (getEmployeeById
 * -> findEmployeeById, addEmployeeProfile -> createEmployee, etc.) so
 * every call site only had to add `await`, not restructure — the file's
 * own old comments ("swapping it for a real...write later only means
 * changing this one function's body") already anticipated this.
 *
 * The whole EmployeeProfile is stored as one JSON blob per row (`data`) —
 * a full relational breakdown of personal/employment/labourLaw/leave/
 * payroll/documents/education/assets/notes/auditLog/quickStats is a much
 * larger, separate project than "persist what's already there," so this
 * keeps the exact existing nested shape and just makes it durable. `id`
 * and `finCode` are real, indexed/unique columns since those are the only
 * two things ever queried or uniqued by; everything else is read by
 * loading `data` and reading it as a plain EmployeeProfile.
 */

function toProfile(row: { data: unknown }): EmployeeProfile {
  return row.data as EmployeeProfile
}

export function findAllEmployees(client: PrismaClientOrTransaction = prisma): Promise<EmployeeProfile[]> {
  return client.employee.findMany({ orderBy: { createdAt: "desc" } }).then((rows) => rows.map(toProfile))
}

export async function findEmployeeById(
  id: string,
  client: PrismaClientOrTransaction = prisma
): Promise<EmployeeProfile | null> {
  const row = await client.employee.findUnique({ where: { id } })
  return row ? toProfile(row) : null
}

export async function findEmployeeByFin(
  finCode: string,
  client: PrismaClientOrTransaction = prisma
): Promise<EmployeeProfile | null> {
  const normalized = finCode.trim().toUpperCase()
  const row = await client.employee.findUnique({ where: { finCode: normalized } })
  return row ? toProfile(row) : null
}

export async function isEmployeeIdTaken(id: string, client: PrismaClientOrTransaction = prisma): Promise<boolean> {
  const row = await client.employee.findUnique({ where: { id }, select: { id: true } })
  return row !== null
}

/**
 * Used by Import for FIN-based idempotency, and by Create/Edit to enforce
 * global FIN uniqueness. excludeId lets Edit ignore the employee's own
 * current record — Import never passes it, since every imported row is a
 * new employee.
 */
export async function isFinTaken(
  finCode: string,
  excludeId?: string,
  client: PrismaClientOrTransaction = prisma
): Promise<boolean> {
  const normalized = finCode.trim().toUpperCase()
  const row = await client.employee.findUnique({ where: { finCode: normalized }, select: { id: true } })
  return row !== null && row.id !== excludeId
}

/** Inserts a newly created profile. Stands in for what addEmployeeProfile used to do in-memory. */
export async function createEmployee(
  profile: EmployeeProfile,
  client: PrismaClientOrTransaction = prisma
): Promise<void> {
  await client.employee.create({
    data: {
      id: profile.id,
      finCode: profile.personal.finCode.trim().toUpperCase(),
      data: profile as unknown as object,
    },
  })
}

/** Replaces an existing profile. Stands in for what updateEmployeeProfile used to do in-memory. */
export async function updateEmployee(
  id: string,
  profile: EmployeeProfile,
  client: PrismaClientOrTransaction = prisma
): Promise<void> {
  await client.employee.update({
    where: { id },
    data: {
      finCode: profile.personal.finCode.trim().toUpperCase(),
      data: profile as unknown as object,
    },
  })
}
