import { prisma } from "@/lib/prisma"
import type { GradeModel } from "@/generated/prisma/models"

export type { GradeModel as Grade }

export interface GradeInput {
  name: string
  code?: string
  description?: string
}

async function generateUniqueCode(base: string): Promise<string> {
  const slug =
    base
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
      .slice(0, 24) || "GRD"
  let code = slug
  let suffix = 2
  while (await prisma.grade.findUnique({ where: { code } })) {
    code = `${slug}-${suffix}`
    suffix += 1
  }
  return code
}

export function findAllGrades(): Promise<GradeModel[]> {
  return prisma.grade.findMany({ orderBy: { name: "asc" } })
}

export function findActiveGrades(): Promise<GradeModel[]> {
  return prisma.grade.findMany({ where: { active: true }, orderBy: { name: "asc" } })
}

export function findGradeById(id: string): Promise<GradeModel | null> {
  return prisma.grade.findUnique({ where: { id } })
}

export async function createGrade(input: GradeInput): Promise<GradeModel> {
  const code = input.code?.trim() ? input.code.trim().toUpperCase() : await generateUniqueCode(input.name)
  return prisma.grade.create({
    data: { name: input.name, code, description: input.description || null },
  })
}

export async function updateGrade(id: string, input: GradeInput): Promise<GradeModel> {
  return prisma.grade.update({
    where: { id },
    data: {
      name: input.name,
      ...(input.code?.trim() ? { code: input.code.trim().toUpperCase() } : {}),
      description: input.description || null,
    },
  })
}

export function archiveGrade(id: string): Promise<GradeModel> {
  return prisma.grade.update({ where: { id }, data: { active: false } })
}

export function restoreGrade(id: string): Promise<GradeModel> {
  return prisma.grade.update({ where: { id }, data: { active: true } })
}
