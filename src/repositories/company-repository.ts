import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { CompanyModel } from "@/generated/prisma/models"

export type { CompanyModel as Company }

export interface CompanyInput {
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
      .slice(0, 24) || "CO"
  let code = slug
  let suffix = 2
  while (await client.company.findUnique({ where: { code } })) {
    code = `${slug}-${suffix}`
    suffix += 1
  }
  return code
}

export function findAllCompanies(): Promise<CompanyModel[]> {
  return prisma.company.findMany({ orderBy: { name: "asc" } })
}

export function findActiveCompanies(): Promise<CompanyModel[]> {
  return prisma.company.findMany({ where: { active: true }, orderBy: { name: "asc" } })
}

export function findCompanyById(id: string): Promise<CompanyModel | null> {
  return prisma.company.findUnique({ where: { id } })
}

export async function createCompany(
  input: CompanyInput,
  client: PrismaClientOrTransaction = prisma
): Promise<CompanyModel> {
  const code = input.code?.trim() ? input.code.trim().toUpperCase() : await generateUniqueCode(input.name, client)
  return client.company.create({
    data: { name: input.name, code, description: input.description || null },
  })
}

export async function updateCompany(id: string, input: CompanyInput): Promise<CompanyModel> {
  return prisma.company.update({
    where: { id },
    data: {
      name: input.name,
      ...(input.code?.trim() ? { code: input.code.trim().toUpperCase() } : {}),
      description: input.description || null,
    },
  })
}

export function archiveCompany(id: string): Promise<CompanyModel> {
  return prisma.company.update({ where: { id }, data: { active: false } })
}

export function restoreCompany(id: string): Promise<CompanyModel> {
  return prisma.company.update({ where: { id }, data: { active: true } })
}
