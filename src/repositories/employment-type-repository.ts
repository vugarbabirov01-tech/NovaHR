import { prisma } from "@/lib/prisma"
import type { EmploymentTypeModel } from "@/generated/prisma/models"

export type { EmploymentTypeModel as EmploymentType }

export interface EmploymentTypeInput {
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
      .slice(0, 24) || "ET"
  let code = slug
  let suffix = 2
  while (await prisma.employmentType.findUnique({ where: { code } })) {
    code = `${slug}-${suffix}`
    suffix += 1
  }
  return code
}

export function findAllEmploymentTypes(): Promise<EmploymentTypeModel[]> {
  return prisma.employmentType.findMany({ orderBy: { name: "asc" } })
}

export function findActiveEmploymentTypes(): Promise<EmploymentTypeModel[]> {
  return prisma.employmentType.findMany({ where: { active: true }, orderBy: { name: "asc" } })
}

export function findEmploymentTypeById(id: string): Promise<EmploymentTypeModel | null> {
  return prisma.employmentType.findUnique({ where: { id } })
}

export async function createEmploymentType(input: EmploymentTypeInput): Promise<EmploymentTypeModel> {
  const code = input.code?.trim() ? input.code.trim().toUpperCase() : await generateUniqueCode(input.name)
  return prisma.employmentType.create({
    data: { name: input.name, code, description: input.description || null },
  })
}

export async function updateEmploymentType(id: string, input: EmploymentTypeInput): Promise<EmploymentTypeModel> {
  return prisma.employmentType.update({
    where: { id },
    data: {
      name: input.name,
      ...(input.code?.trim() ? { code: input.code.trim().toUpperCase() } : {}),
      description: input.description || null,
    },
  })
}

export function archiveEmploymentType(id: string): Promise<EmploymentTypeModel> {
  return prisma.employmentType.update({ where: { id }, data: { active: false } })
}

export function restoreEmploymentType(id: string): Promise<EmploymentTypeModel> {
  return prisma.employmentType.update({ where: { id }, data: { active: true } })
}
