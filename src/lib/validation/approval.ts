import { z } from "zod"

// Shared validation for the generic Approval Engine's workflow-authoring
// Server Actions — same convention as leave.ts/master-data.ts: actions
// parse against these before touching a repository, so invalid input never
// reaches Prisma.

export { idSchema } from "@/lib/validation/master-data"

const name = z.string().trim().min(1, "This field is required.").max(120)
const code = z.string().trim().min(1, "Code is required.").max(60)
const description = z.string().trim().max(500).optional()

/**
 * Deliberately shallow: this only guarantees conditionExpression /
 * approverResolutionConfig / uiMetadata / canvasMetadata are well-formed,
 * JSON-serializable values — never their per-resolution-type or
 * per-condition-operator shape. That shape belongs to whichever consumer
 * interprets it later (the condition evaluator, a resolver plugin, a
 * canvas renderer) — validating it here would smuggle business/rendering
 * assumptions into the generic authoring layer, which Phase 4B is
 * deliberately avoiding (see the self-review's point 6).
 */
const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
type JsonValue = z.infer<typeof jsonPrimitiveSchema> | JsonValue[] | { [key: string]: JsonValue }
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonPrimitiveSchema, z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)])
)

export const approvalApproverResolutionTypeSchema = z.enum([
  "SPECIFIC_EMPLOYEE",
  "DIRECT_MANAGER",
  "MANAGER_CHAIN_LEVEL",
  "ROLE",
  "POSITION",
  "DEPARTMENT_HEAD",
  "COMPANY_CEO",
  "CUSTOM_RULE",
])

export const approvalQuorumModeSchema = z.enum(["ANY_ONE", "ALL", "MAJORITY"])

export const approvalWorkflowDefinitionInputSchema = z.object({
  code,
  name,
  description,
  entityType: z.string().trim().min(1, "Entity type is required.").max(60),
  companyId: z.string().trim().min(1).optional().nullable(),
  branchId: z.string().trim().min(1).optional().nullable(),
  departmentId: z.string().trim().min(1).optional().nullable(),
  conditionExpression: jsonValueSchema.optional().nullable(),
  priority: z.number().int().optional(),
  isTemplate: z.boolean().optional(),
  createdBy: z.string().trim().min(1, "Actor is required."),
})

export const approvalWorkflowDefinitionUpdateSchema = approvalWorkflowDefinitionInputSchema.omit({ createdBy: true })

export const approvalStepDefinitionInputSchema = z.object({
  stepOrder: z.number().int().positive("Step order must be a positive integer."),
  branchKey: z.string().trim().min(1).max(60).optional(),
  name,
  approverResolutionType: approvalApproverResolutionTypeSchema,
  approverResolutionConfig: jsonValueSchema.optional().nullable(),
  quorumMode: approvalQuorumModeSchema.optional(),
  conditionExpression: jsonValueSchema.optional().nullable(),
  skipIfNoApproverResolved: z.boolean().optional(),
  isOptional: z.boolean().optional(),
  slaHours: z.number().int().positive().optional().nullable(),
  uiMetadata: jsonValueSchema.optional().nullable(),
})

// The "save the whole canvas" payload — a builder submits every step in
// the draft version at once. An empty array is valid input (a draft
// mid-edit can legitimately have zero steps); publishWorkflowVersion is
// where "must have at least one step" is actually enforced.
export const approvalStepDefinitionListSchema = z.array(approvalStepDefinitionInputSchema)

export const approvalWorkflowCanvasMetadataSchema = jsonValueSchema.nullable()

export const approvalWorkflowDefinitionCloneSchema = z.object({
  code,
  name,
  createdBy: z.string().trim().min(1, "Actor is required."),
})

// ---------------------------------------------------------------------------
// Phase 4C — runtime (Core Engine) operations.
// ---------------------------------------------------------------------------

const actor = z.string().trim().min(1, "Actor is required.")
const comment = z.string().trim().max(1000).optional().nullable()

export const submitForApprovalInputSchema = z.object({
  entityType: z.string().trim().min(1, "Entity type is required.").max(60),
  entityId: z.string().trim().min(1, "Entity id is required."),
  contextPayload: jsonValueSchema,
  submittedBy: actor,
  companyId: z.string().trim().min(1).optional().nullable(),
  branchId: z.string().trim().min(1).optional().nullable(),
  departmentId: z.string().trim().min(1).optional().nullable(),
})

export const approvalDecisionInputSchema = z.object({
  stepApproverId: z.string().trim().min(1, "Missing id."),
  actorEmployeeId: actor,
  comment,
})

export const approvalInstanceActionInputSchema = z.object({
  instanceId: z.string().trim().min(1, "Missing id."),
  actorEmployeeId: actor,
  comment,
})
