import { prisma } from "@/lib/prisma"
import type { BranchModel } from "@/generated/prisma/models"

export type { BranchModel as Branch }

export interface BranchInput {
  name: string
  companyId: string
  code?: string
  description?: string
}

async function generateUniqueCode(base: string): Promise<string> {
  const slug =
    base
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
      .slice(0, 24) || "BR"
  let code = slug
  let suffix = 2
  while (await prisma.branch.findUnique({ where: { code } })) {
    code = `${slug}-${suffix}`
    suffix += 1
  }
  return code
}

export function findAllBranches(): Promise<BranchModel[]> {
  return prisma.branch.findMany({ orderBy: { name: "asc" } })
}

export function findActiveBranches(): Promise<BranchModel[]> {
  return prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } })
}

export function findActiveBranchesByCompany(companyId: string): Promise<BranchModel[]> {
  return prisma.branch.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } })
}

export function findBranchById(id: string): Promise<BranchModel | null> {
  return prisma.branch.findUnique({ where: { id } })
}

export async function createBranch(input: BranchInput): Promise<BranchModel> {
  const code = input.code?.trim() ? input.code.trim().toUpperCase() : await generateUniqueCode(input.name)
  return prisma.branch.create({
    data: { name: input.name, code, companyId: input.companyId, description: input.description || null },
  })
}

export async function updateBranch(id: string, input: BranchInput): Promise<BranchModel> {
  return prisma.branch.update({
    where: { id },
    data: {
      name: input.name,
      companyId: input.companyId,
      ...(input.code?.trim() ? { code: input.code.trim().toUpperCase() } : {}),
      description: input.description || null,
    },
  })
}

export function archiveBranch(id: string): Promise<BranchModel> {
  return prisma.branch.update({ where: { id }, data: { active: false } })
}

export function restoreBranch(id: string): Promise<BranchModel> {
  return prisma.branch.update({ where: { id }, data: { active: true } })
}
