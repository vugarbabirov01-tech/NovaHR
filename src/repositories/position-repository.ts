import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { PositionModel } from "@/generated/prisma/models"

export type { PositionModel as Position }

export interface PositionInput {
  title: string
  departmentId: string
  code?: string
  description?: string
}

async function generateUniqueCode(base: string, client: PrismaClientOrTransaction): Promise<string> {
  const slug =
    base
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
      .slice(0, 24) || "POS"
  let code = slug
  let suffix = 2
  while (await client.position.findUnique({ where: { code } })) {
    code = `${slug}-${suffix}`
    suffix += 1
  }
  return code
}

export function findAllPositions(): Promise<PositionModel[]> {
  return prisma.position.findMany({ orderBy: { title: "asc" } })
}

export function findActivePositions(): Promise<PositionModel[]> {
  return prisma.position.findMany({ where: { active: true }, orderBy: { title: "asc" } })
}

export function findActivePositionsByDepartment(departmentId: string): Promise<PositionModel[]> {
  return prisma.position.findMany({ where: { active: true, departmentId }, orderBy: { title: "asc" } })
}

export function findPositionById(id: string): Promise<PositionModel | null> {
  return prisma.position.findUnique({ where: { id } })
}

export async function createPosition(
  input: PositionInput,
  client: PrismaClientOrTransaction = prisma
): Promise<PositionModel> {
  const code = input.code?.trim() ? input.code.trim().toUpperCase() : await generateUniqueCode(input.title, client)
  return client.position.create({
    data: {
      title: input.title,
      code,
      departmentId: input.departmentId,
      description: input.description || null,
    },
  })
}

export async function updatePosition(id: string, input: PositionInput): Promise<PositionModel> {
  return prisma.position.update({
    where: { id },
    data: {
      title: input.title,
      departmentId: input.departmentId,
      ...(input.code?.trim() ? { code: input.code.trim().toUpperCase() } : {}),
      description: input.description || null,
    },
  })
}

export function archivePosition(id: string): Promise<PositionModel> {
  return prisma.position.update({ where: { id }, data: { active: false } })
}

export function restorePosition(id: string): Promise<PositionModel> {
  return prisma.position.update({ where: { id }, data: { active: true } })
}
