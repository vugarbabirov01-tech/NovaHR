import type { TerminationWizardData } from "@/types/termination-wizard"

export type TerminationValidationErrors = Partial<
  Record<"terminationDate" | "lastWorkingDay" | "reason", string>
>

export interface TerminationValidationMessages {
  required: string
}

/** Mirrors employee-wizard-validation.ts's per-step shape — Step 1 is the
 * only step with required fields; Steps 2-6 are read-only or optional. */
export function validateTerminationInfoStep(
  data: TerminationWizardData,
  messages: TerminationValidationMessages
): TerminationValidationErrors {
  const errors: TerminationValidationErrors = {}
  if (!data.terminationDate) errors.terminationDate = messages.required
  if (!data.lastWorkingDay) errors.lastWorkingDay = messages.required
  if (!data.reason) errors.reason = messages.required
  return errors
}
