import type { EmployeeWizardData } from "@/types/employee-wizard"

export type WizardValidationErrors = Partial<Record<keyof EmployeeWizardData, string>>

export interface WizardValidationMessages {
  required: string
}

function validatePersonalStep(
  data: EmployeeWizardData,
  messages: WizardValidationMessages
): WizardValidationErrors {
  const errors: WizardValidationErrors = {}
  if (!data.firstName.trim()) errors.firstName = messages.required
  if (!data.lastName.trim()) errors.lastName = messages.required
  if (!data.gender) errors.gender = messages.required
  if (!data.dateOfBirth) errors.dateOfBirth = messages.required
  if (!data.finCode.trim()) errors.finCode = messages.required
  if (!data.phone.trim()) errors.phone = messages.required
  return errors
}

function validateEmploymentStep(
  data: EmployeeWizardData,
  messages: WizardValidationMessages
): WizardValidationErrors {
  const errors: WizardValidationErrors = {}
  if (!data.hireDate) errors.hireDate = messages.required
  if (!data.employmentType) errors.employmentType = messages.required
  if (!data.contractType) errors.contractType = messages.required
  if (!data.departmentId) errors.departmentId = messages.required
  if (!data.positionId) errors.positionId = messages.required
  if (!data.companyId) errors.companyId = messages.required
  if (!data.workLocationType) errors.workLocationType = messages.required
  return errors
}

function validatePayrollStep(
  data: EmployeeWizardData,
  messages: WizardValidationMessages
): WizardValidationErrors {
  const errors: WizardValidationErrors = {}
  if (data.baseSalary === "" || Number(data.baseSalary) <= 0) errors.baseSalary = messages.required
  if (!data.currency) errors.currency = messages.required
  return errors
}

export function validateWizardStep(
  stepIndex: number,
  data: EmployeeWizardData,
  messages: WizardValidationMessages
): WizardValidationErrors {
  switch (stepIndex) {
    case 0:
      return validatePersonalStep(data, messages)
    case 1:
      return validateEmploymentStep(data, messages)
    case 3:
      return validatePayrollStep(data, messages)
    default:
      return {}
  }
}

export const WIZARD_STEP_COUNT = 6

/**
 * Edit's own, deliberately narrower gate — validateAllWizardSteps (Create's
 * full required-field sweep) would re-flag things Edit never asked the user
 * to touch: plenty of real imported employees still have baseSalary === 0
 * (no payroll set up yet), a legitimate state that must stay editable for
 * an unrelated change like fixing a phone number. Only the fields whose
 * absence would make the record itself unusable/unidentifiable are checked
 * here — firstName/lastName so the record still has a name, finCode
 * because it's this app's whole primary-identifier scheme (see
 * employee-repository.ts). Server-side duplicate-FIN/duplicate-employee-
 * number checks (employees/actions.ts) are the real backstop either way.
 */
export function validateEditEssentials(
  data: EmployeeWizardData,
  messages: WizardValidationMessages
): WizardValidationErrors {
  const errors: WizardValidationErrors = {}
  if (!data.firstName.trim()) errors.firstName = messages.required
  if (!data.lastName.trim()) errors.lastName = messages.required
  if (!data.finCode.trim()) errors.finCode = messages.required
  return errors
}

export function validateAllWizardSteps(
  data: EmployeeWizardData,
  messages: WizardValidationMessages
): { firstInvalidStep: number | null; errorsByStep: WizardValidationErrors[] } {
  const errorsByStep = Array.from({ length: WIZARD_STEP_COUNT }, (_, stepIndex) =>
    validateWizardStep(stepIndex, data, messages)
  )
  const firstInvalidStep = errorsByStep.findIndex((errors) => Object.keys(errors).length > 0)
  return {
    firstInvalidStep: firstInvalidStep === -1 ? null : firstInvalidStep,
    errorsByStep,
  }
}
