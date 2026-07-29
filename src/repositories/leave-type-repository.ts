import { prisma } from "@/lib/prisma"
import type { LeaveTypeModel } from "@/generated/prisma/models"
import type { LeaveUnit } from "@/generated/prisma/enums"

export type { LeaveTypeModel as LeaveType }

export interface LeaveTypeInput {
  code?: string
  name: string
  description?: string
  unit: LeaveUnit
  isPaid?: boolean
  requiresBalance?: boolean
}

async function generateUniqueCode(base: string): Promise<string> {
  const slug =
    base
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
      .slice(0, 24) || "LT"
  let code = slug
  let suffix = 2
  while (await prisma.leaveType.findUnique({ where: { code } })) {
    code = `${slug}-${suffix}`
    suffix += 1
  }
  return code
}

export function findAllLeaveTypes(): Promise<LeaveTypeModel[]> {
  return prisma.leaveType.findMany({ orderBy: { name: "asc" } })
}

export function findActiveLeaveTypes(): Promise<LeaveTypeModel[]> {
  return prisma.leaveType.findMany({ where: { active: true }, orderBy: { name: "asc" } })
}

export function findLeaveTypeById(id: string): Promise<LeaveTypeModel | null> {
  return prisma.leaveType.findUnique({ where: { id } })
}

export async function createLeaveType(input: LeaveTypeInput): Promise<LeaveTypeModel> {
  const code = input.code?.trim() ? input.code.trim().toUpperCase() : await generateUniqueCode(input.name)
  return prisma.leaveType.create({
    data: {
      code,
      name: input.name,
      description: input.description || null,
      unit: input.unit,
      isPaid: input.isPaid ?? true,
      requiresBalance: input.requiresBalance ?? true,
    },
  })
}

export function updateLeaveType(id: string, input: LeaveTypeInput): Promise<LeaveTypeModel> {
  return prisma.leaveType.update({
    where: { id },
    data: {
      ...(input.code?.trim() ? { code: input.code.trim().toUpperCase() } : {}),
      name: input.name,
      description: input.description || null,
      unit: input.unit,
      isPaid: input.isPaid ?? true,
      requiresBalance: input.requiresBalance ?? true,
    },
  })
}

export function archiveLeaveType(id: string): Promise<LeaveTypeModel> {
  return prisma.leaveType.update({ where: { id }, data: { active: false } })
}

export function restoreLeaveType(id: string): Promise<LeaveTypeModel> {
  return prisma.leaveType.update({ where: { id }, data: { active: true } })
}
