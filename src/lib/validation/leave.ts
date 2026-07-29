import { z } from "zod"

// Shared validation for the Leave Management module's Phase 1 Server
// Actions — same convention as master-data.ts: Server Actions parse against
// these before touching a repository, so invalid input never reaches
// Prisma. idSchema is reused from master-data.ts rather than redefined here
// — it isn't master-data-specific, it's just generic id validation.

export { idSchema } from "@/lib/validation/master-data"

const name = z.string().trim().min(1, "This field is required.").max(120)
const code = z.string().trim().max(20).optional()
const description = z.string().trim().max(500).optional()
const note = z.string().trim().max(1000).optional()
const isoDate = z.string().trim().min(1, "A date is required.")

export const leaveUnitSchema = z.enum(["DAYS", "HOURS"])

export const leaveTypeInputSchema = z.object({
  name,
  code,
  description,
  unit: leaveUnitSchema,
  isPaid: z.boolean().optional(),
  requiresBalance: z.boolean().optional(),
})

export const leaveAccrualMethodSchema = z.enum(["NONE", "MONTHLY", "ANNUAL", "ANNIVERSARY"])

export const leavePolicyInputSchema = z.object({
  leaveTypeId: z.string().trim().min(1, "Leave type is required."),
  companyId: z.string().trim().min(1).optional().nullable(),
  branchId: z.string().trim().min(1).optional().nullable(),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.optional().nullable(),
  entitlementUnitsPerYear: z.number().nonnegative().optional().nullable(),
  accrualMethod: leaveAccrualMethodSchema.optional(),
  requiresApproval: z.boolean().optional(),
  carryForwardAllowed: z.boolean().optional(),
  carryForwardMaxUnits: z.number().nonnegative().optional().nullable(),
  carryForwardExpiryMonths: z.number().int().nonnegative().optional().nullable(),
  encashmentAllowed: z.boolean().optional(),
  balanceValidationMode: z.enum(["BLOCK", "WARN"]).optional(),
})

export const holidayInputSchema = z.object({
  name,
  date: isoDate,
  companyId: z.string().trim().min(1).optional().nullable(),
  branchId: z.string().trim().min(1).optional().nullable(),
  recurringAnnually: z.boolean().optional(),
})

// Structural validation only — does not check the entry against a policy or
// an existing balance. That's Phase 2's job; this only guarantees the shape
// of what gets written to the ledger is well-formed.
export const leaveEntryTypeSchema = z.enum([
  "OPENING_BALANCE",
  "IMPORTED_BALANCE",
  "ACCRUAL",
  "CARRY_FORWARD",
  "LEAVE_TAKEN",
  "LEAVE_CANCELLED",
  "MANUAL_ADJUSTMENT",
  "EXPIRY",
  "SETTLEMENT",
  "ENCASHMENT",
])

export const leaveEntryReferenceTypeSchema = z.enum([
  "LEAVE_REQUEST",
  "MANUAL",
  "IMPORT",
  "ACCRUAL_RUN",
  "SYSTEM",
])

export const leaveLedgerEntryInputSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee is required."),
  leaveTypeId: z.string().trim().min(1, "Leave type is required."),
  companyId: z.string().trim().min(1).optional().nullable(),
  entryType: leaveEntryTypeSchema,
  amount: z.number().refine((value) => value !== 0, "Amount cannot be zero."),
  unit: leaveUnitSchema,
  effectiveDate: isoDate,
  referenceType: leaveEntryReferenceTypeSchema.optional().nullable(),
  referenceId: z.string().trim().min(1).optional().nullable(),
  note,
  createdBy: z.string().trim().min(1, "Actor is required."),
})

// Structural validation for a Leave Request submission — does not itself
// decide eligibility, balance sufficiency, or dates; that's
// leave-request-service.ts's job. This only guarantees well-formed input.
export const leaveRequestInputSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee is required."),
  leaveTypeId: z.string().trim().min(1, "Leave type is required."),
  companyId: z.string().trim().min(1).optional().nullable(),
  branchId: z.string().trim().min(1).optional().nullable(),
  startDate: isoDate,
  numberOfDays: z.number().positive("Number of days must be greater than zero."),
  reason: z.string().trim().max(1000).optional(),
})
