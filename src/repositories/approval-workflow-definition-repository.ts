import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { ApprovalWorkflowDefinitionModel } from "@/generated/prisma/models"

export type { ApprovalWorkflowDefinitionModel as ApprovalWorkflowDefinition }

/**
 * The "which workflow applies" matcher — entityType is a plain string this
 * repository never validates against a fixed list (see the schema.prisma
 * file header): any module can create a definition for its own entityType
 * without this file changing. Nullable companyId/branchId/departmentId
 * follow the same scoping convention as LeavePolicy (null = global
 * default). No update/publish/version logic here — that's the workflow
 * authoring service, out of scope for Phase 4A.
 */
export interface ApprovalWorkflowDefinitionInput {
  code: string
  name: string
  description?: string | null
  entityType: string
  companyId?: string | null
  branchId?: string | null
  departmentId?: string | null
  conditionExpression?: Prisma.InputJsonValue | null
  priority?: number
  /** True = a cloning source only, excluded from a later phase's
   * auto-matching resolution. See the schema.prisma model comment. */
  isTemplate?: boolean
  createdBy: string
}

/** Everything but createdBy — provenance of who originally created a
 * definition is set once at creation and never revisited by an update,
 * the same way createdAt never changes on update elsewhere in this
 * codebase. */
export type ApprovalWorkflowDefinitionUpdateInput = Omit<ApprovalWorkflowDefinitionInput, "createdBy">

/** Prisma's Json input type has no direct "null" member — an explicit
 * null must be spelled Prisma.NullableJsonNullValueInput.JsonNull, while
 * plain `undefined` means "use the column default" on create. */
function toJsonInput(value: Prisma.InputJsonValue | null | undefined) {
  if (value === undefined) return undefined
  if (value === null) return Prisma.NullableJsonNullValueInput.JsonNull
  return value
}

function toSharedData(input: ApprovalWorkflowDefinitionUpdateInput) {
  return {
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    entityType: input.entityType,
    companyId: input.companyId ?? null,
    branchId: input.branchId ?? null,
    departmentId: input.departmentId ?? null,
    conditionExpression: toJsonInput(input.conditionExpression),
    priority: input.priority ?? 0,
    isTemplate: input.isTemplate ?? false,
  } as const
}

export function findActiveWorkflowDefinitionsByEntityType(
  entityType: string
): Promise<ApprovalWorkflowDefinitionModel[]> {
  return prisma.approvalWorkflowDefinition.findMany({
    where: { active: true, entityType },
    orderBy: { priority: "desc" },
  })
}

/** Everything, active or archived, template or not — the "choose a
 * workflow to edit or clone" list a future authoring screen reads. */
export function findAllWorkflowDefinitions(): Promise<ApprovalWorkflowDefinitionModel[]> {
  return prisma.approvalWorkflowDefinition.findMany({ orderBy: { createdAt: "desc" } })
}

export function findWorkflowDefinitionById(id: string): Promise<ApprovalWorkflowDefinitionModel | null> {
  return prisma.approvalWorkflowDefinition.findUnique({ where: { id } })
}

export function findWorkflowDefinitionByCode(code: string): Promise<ApprovalWorkflowDefinitionModel | null> {
  return prisma.approvalWorkflowDefinition.findUnique({ where: { code } })
}

export function createWorkflowDefinition(
  input: ApprovalWorkflowDefinitionInput
): Promise<ApprovalWorkflowDefinitionModel> {
  return prisma.approvalWorkflowDefinition.create({
    data: { ...toSharedData(input), createdBy: input.createdBy },
  })
}

export function updateWorkflowDefinition(
  id: string,
  input: ApprovalWorkflowDefinitionUpdateInput
): Promise<ApprovalWorkflowDefinitionModel> {
  return prisma.approvalWorkflowDefinition.update({ where: { id }, data: toSharedData(input) })
}

export function archiveWorkflowDefinition(id: string): Promise<ApprovalWorkflowDefinitionModel> {
  return prisma.approvalWorkflowDefinition.update({ where: { id }, data: { active: false } })
}

export function restoreWorkflowDefinition(id: string): Promise<ApprovalWorkflowDefinitionModel> {
  return prisma.approvalWorkflowDefinition.update({ where: { id }, data: { active: true } })
}
