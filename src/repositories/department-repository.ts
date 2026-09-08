import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { DepartmentModel } from "@/generated/prisma/models"

export type { DepartmentModel as Department }

export interface DepartmentInput {
  name: string
  code?: string
  description?: string
}

async function generateUniqueCode(base: string, client: PrismaClientOrTransaction): Promise<string> {
  const slug =
    base
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
      .slice(0, 24) || "DEPT"
  let code = slug
  let suffix = 2
  while (await client.department.findUnique({ where: { code } })) {
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

export async function createDepartment(
  input: DepartmentInput,
  client: PrismaClientOrTransaction = prisma
): Promise<DepartmentModel> {
  const code = input.code?.trim() ? input.code.trim().toUpperCase() : await generateUniqueCode(input.name, client)
  return client.department.create({
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

/** How many Position rows still point at this department — Position.departmentId is required, so a department can never be deleted while this is above 0. */
export function countPositionsInDepartment(departmentId: string): Promise<number> {
  return prisma.position.count({ where: { departmentId } })
}

/** Permanent removal — unlike archive, this can't be undone. The caller (deleteDepartmentAction) is responsible for confirming nothing still references this department (positions, employees) before calling it. */
export function deleteDepartment(id: string): Promise<DepartmentModel> {
  return prisma.department.delete({ where: { id } })
}
