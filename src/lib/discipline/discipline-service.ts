import { prisma } from "@/lib/prisma"
import {
  validateDisciplineInput,
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
