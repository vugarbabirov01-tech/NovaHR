import { prisma } from "@/lib/prisma"
import type { DepartmentModel } from "@/generated/prisma/models"

export type { DepartmentModel as Department }

export interface DepartmentInput {
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
      .slice(0, 24) || "DEPT"
  let code = slug
  let suffix = 2
  while (await prisma.department.findUnique({ where: { code } })) {
    code = `${slug}-${suffix}`
    suffix += 1
  }
  return code
}

export function findAllDepartments(): Promise<DepartmentModel[]> {
  return prisma.department.findMany({ orderBy: { name: "asc" } })
}

export function findActiveDepartments(): Promise<DepartmentModel[]> {
  return prisma.department.findMany({ where: { active: true }, orderBy: { name: "asc" } })
}

export function findDepartmentById(id: string): Promise<DepartmentModel | null> {
  return prisma.department.findUnique({ where: { id } })
}

export async function createDepartment(input: DepartmentInput): Promise<DepartmentModel> {
  const code = input.code?.trim() ? input.code.trim().toUpperCase() : await generateUniqueCode(input.name)
  return prisma.department.create({
    data: { name: input.name, code, description: input.description || null },
  })
}

export async function updateDepartment(id: string, input: DepartmentInput): Promise<DepartmentModel> {
  return prisma.department.update({
    where: { id },
    data: {
      name: input.name,
      ...(input.code?.trim() ? { code: input.code.trim().toUpperCase() } : {}),
      description: input.description || null,
    },
  })
}

export function archiveDepartment(id: string): Promise<DepartmentModel> {
  return prisma.department.update({ where: { id }, data: { active: false } })
}

export function restoreDepartment(id: string): Promise<DepartmentModel> {
  return prisma.department.update({ where: { id }, data: { active: true } })
}
