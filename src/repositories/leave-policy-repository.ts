import { prisma } from "@/lib/prisma"
import type { LeavePolicyModel } from "@/generated/prisma/models"
import type { LeaveAccrualMethod } from "@/generated/prisma/enums"

export type { LeavePolicyModel as LeavePolicy }

export interface LeavePolicyInput {
  leaveTypeId: string
  companyId?: string | null
  branchId?: string | null
  effectiveFrom: Date
  effectiveTo?: Date | null
  entitlementUnitsPerYear?: number | null
  accrualMethod?: LeaveAccrualMethod
  requiresApproval?: boolean
  carryForwardAllowed?: boolean
  carryForwardMaxUnits?: number | null
  carryForwardExpiryMonths?: number | null
  encashmentAllowed?: boolean
  /** "BLOCK" | "WARN" — read by leave-request-service.ts at submission
   * time. Never inferred from the leave type's name/code. */
  balanceValidationMode?: string
}

function toData(input: LeavePolicyInput) {
  return {
    leaveTypeId: input.leaveTypeId,
    companyId: input.companyId ?? null,
    branchId: input.branchId ?? null,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    entitlementUnitsPerYear: input.entitlementUnitsPerYear ?? null,
    accrualMethod: input.accrualMethod ?? "NONE",
    requiresApproval: input.requiresApproval ?? true,
    carryForwardAllowed: input.carryForwardAllowed ?? false,
    carryForwardMaxUnits: input.carryForwardMaxUnits ?? null,
    carryForwardExpiryMonths: input.carryForwardExpiryMonths ?? null,
    encashmentAllowed: input.encashmentAllowed ?? false,
    balanceValidationMode: input.balanceValidationMode ?? "WARN",
  } as const
}

export function findAllLeavePolicies(): Promise<LeavePolicyModel[]> {
  return prisma.leavePolicy.findMany({ orderBy: { effectiveFrom: "desc" } })
}

export function findActiveLeavePolicies(): Promise<LeavePolicyModel[]> {
  return prisma.leavePolicy.findMany({ where: { active: true }, orderBy: { effectiveFrom: "desc" } })
}

export function findActiveLeavePoliciesByLeaveType(leaveTypeId: string): Promise<LeavePolicyModel[]> {
  return prisma.leavePolicy.findMany({
    where: { active: true, leaveTypeId },
    orderBy: { effectiveFrom: "desc" },
  })
}

export function findLeavePolicyById(id: string): Promise<LeavePolicyModel | null> {
  return prisma.leavePolicy.findUnique({ where: { id } })
}

export function createLeavePolicy(input: LeavePolicyInput): Promise<LeavePolicyModel> {
  return prisma.leavePolicy.create({ data: toData(input) })
}

export function updateLeavePolicy(id: string, input: LeavePolicyInput): Promise<LeavePolicyModel> {
  return prisma.leavePolicy.update({ where: { id }, data: toData(input) })
}

export function archiveLeavePolicy(id: string): Promise<LeavePolicyModel> {
  return prisma.leavePolicy.update({ where: { id }, data: { active: false } })
}

export function restoreLeavePolicy(id: string): Promise<LeavePolicyModel> {
  return prisma.leavePolicy.update({ where: { id }, data: { active: true } })
}
