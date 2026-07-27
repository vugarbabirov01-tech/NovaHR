import { prisma } from "@/lib/prisma"
import type { WorkScheduleModel } from "@/generated/prisma/models"

export type { WorkScheduleModel as WorkSchedule }

export interface WorkScheduleInput {
  label: string
  code?: string
  description?: string
}

async function generateUniqueCode(base: string): Promise<string> {
  const slug =
    base
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
      .slice(0, 24) || "SCH"
  let code = slug
  let suffix = 2
  while (await prisma.workSchedule.findUnique({ where: { code } })) {
    code = `${slug}-${suffix}`
    suffix += 1
  }
  return code
}

export function findAllWorkSchedules(): Promise<WorkScheduleModel[]> {
  return prisma.workSchedule.findMany({ orderBy: { label: "asc" } })
}

export function findActiveWorkSchedules(): Promise<WorkScheduleModel[]> {
  return prisma.workSchedule.findMany({ where: { active: true }, orderBy: { label: "asc" } })
}

export function findWorkScheduleById(id: string): Promise<WorkScheduleModel | null> {
  return prisma.workSchedule.findUnique({ where: { id } })
}

export async function createWorkSchedule(input: WorkScheduleInput): Promise<WorkScheduleModel> {
  const code = input.code?.trim() ? input.code.trim().toUpperCase() : await generateUniqueCode(input.label)
  return prisma.workSchedule.create({
    data: { label: input.label, code, description: input.description || null },
  })
}

export async function updateWorkSchedule(id: string, input: WorkScheduleInput): Promise<WorkScheduleModel> {
  return prisma.workSchedule.update({
    where: { id },
    data: {
      label: input.label,
      ...(input.code?.trim() ? { code: input.code.trim().toUpperCase() } : {}),
      description: input.description || null,
    },
  })
}

export function archiveWorkSchedule(id: string): Promise<WorkScheduleModel> {
  return prisma.workSchedule.update({ where: { id }, data: { active: false } })
}

export function restoreWorkSchedule(id: string): Promise<WorkScheduleModel> {
  return prisma.workSchedule.update({ where: { id }, data: { active: true } })
}
