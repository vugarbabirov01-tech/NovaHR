import { z } from "zod"

// Shared validation for every Administration master-data module. Server
// Actions parse against these before touching a repository, so invalid
// input never reaches Prisma.

const name = z.string().trim().min(1, "This field is required.").max(120)
const code = z.string().trim().max(20).optional()
const description = z.string().trim().max(500).optional()

export const departmentInputSchema = z.object({ name, code, description })
export const companyInputSchema = z.object({ name, code, description })
export const gradeInputSchema = z.object({ name, code, description })
export const employmentTypeInputSchema = z.object({ name, code, description })

export const branchInputSchema = z.object({
  name,
  code,
  description,
  companyId: z.string().trim().min(1, "Company is required."),
})

export const positionInputSchema = z.object({
  title: name,
  code,
  description,
  departmentId: z.string().trim().min(1, "Department is required."),
})

export const workScheduleInputSchema = z.object({
  label: name,
  code,
  description,
  scheduleType: z.enum(["WEEKLY", "ROTATING"]).optional(),
  workingDays: z.string().trim().max(40).optional(),
  rotationOnDays: z.number().int().positive().optional().nullable(),
  rotationOffDays: z.number().int().positive().optional().nullable(),
  rotationStartDate: z.coerce.date().optional().nullable(),
})

export const idSchema = z.string().trim().min(1, "Missing id.")
