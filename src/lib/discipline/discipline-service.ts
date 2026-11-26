import { prisma } from "@/lib/prisma"
import {
  activePenalty,
  validateDisciplineInput,
  type ActivePenalty,
  type DisciplineErrorCode,
  type DisciplineInput,
} from "@/lib/discipline/discipline-rules"

export class DisciplineError extends Error {
  constructor(public readonly code: DisciplineErrorCode) {
    super(code)
  }
}

export interface DisciplinaryActionView {
  id: string
  type: string
  issuedDate: string
  violationDate: string
  reason: string
  basis: string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function data(input: DisciplineInput) {
  return {
    type: input.type,
    issuedDate: input.issuedDate,
    violationDate: input.violationDate,
    reason: input.reason.trim(),
    basis: (input.basis ?? "").trim(),
  }
}

export async function listDisciplinaryActions(employeeId: string): Promise<DisciplinaryActionView[]> {
  const rows = await prisma.disciplinaryAction.findMany({
    where: { employeeId },
    orderBy: [{ issuedDate: "desc" }, { createdAt: "desc" }],
  })
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    issuedDate: row.issuedDate,
    violationDate: row.violationDate,
    reason: row.reason,
    basis: row.basis,
  }))
}

/** Every employee who has a penalty in force today, keyed by employee id. */
export async function listActivePenalties(): Promise<Record<string, ActivePenalty>> {
  const rows = await prisma.disciplinaryAction.findMany({ select: { employeeId: true, type: true, issuedDate: true } })
  const byEmployee = new Map<string, typeof rows>()
  for (const row of rows) byEmployee.set(row.employeeId, [...(byEmployee.get(row.employeeId) ?? []), row])
  const today = todayIso()
  const out: Record<string, ActivePenalty> = {}
  for (const [employeeId, actions] of byEmployee) {
    const penalty = activePenalty(actions, today)
    if (penalty) out[employeeId] = penalty
  }
  return out
}

/** The name of an approved leave covering the date, if the employee was on one (art. 189.2). */
export async function findLeaveOnDate(employeeId: string, date: string): Promise<string | null> {
  const day = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(day.getTime())) return null
  const nextDay = new Date(day.getTime() + 86_400_000)
  const leave = await prisma.leaveRequest.findFirst({
    where: { employeeId, status: "APPROVED", startDate: { lt: nextDay }, endDate: { gte: day } },
    select: { leaveType: { select: { name: true } } },
  })
  return leave?.leaveType.name ?? null
}

export async function addDisciplinaryAction(employeeId: string, input: DisciplineInput): Promise<void> {
  const invalid = validateDisciplineInput(input, todayIso())
  if (invalid) throw new DisciplineError(invalid)
  await prisma.disciplinaryAction.create({ data: { employeeId, ...data(input) } })
}

export async function updateDisciplinaryAction(id: string, input: DisciplineInput): Promise<void> {
  const invalid = validateDisciplineInput(input, todayIso())
  if (invalid) throw new DisciplineError(invalid)
  const existing = await prisma.disciplinaryAction.findUnique({ where: { id } })
  if (!existing) throw new DisciplineError("notFound")
  await prisma.disciplinaryAction.update({ where: { id }, data: data(input) })
}

export async function deleteDisciplinaryAction(id: string): Promise<void> {
  const existing = await prisma.disciplinaryAction.findUnique({ where: { id } })
  if (!existing) throw new DisciplineError("notFound")
  await prisma.disciplinaryAction.delete({ where: { id } })
}
