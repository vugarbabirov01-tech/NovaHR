import type {
  ContractType,
  EmployeeDocument,
  EmployeeLabourLaw,
  EmployeePersonal,
  EmployeeProfile,
  EmploymentType,
  WorkLocationType,
} from "@/types/employee-profile"

/**
 * The subset of EmployeeProfile fields the Employee Wizard can actually
 * edit. Deliberately excludes employment.grade, employment.history,
 * payroll.allowances, employmentStatus, id, leave, education, assets,
 * notes, auditLog and quickStats — none of those are wizard fields, and
 * extractEditableFields / applyEditableFields never touch them, so they
 * can never be recreated or overwritten by an edit.
 */
export interface EmployeeEditableFields {
  employeeNumber: string
  hireDate: string
  probationEndDate?: string
  employmentType: EmploymentType
  contractType: ContractType
  department: string
  position: string
  branch: string
  company: string
  managerId?: string
  managerName?: string
  workSchedule: string
  workLocationType: WorkLocationType
  workLocation: string
  personal: EmployeePersonal
  labourLaw: EmployeeLabourLaw
  bankName: string
  bankAccountNumber: string
  baseSalary: number
  currency: string
  bonus: number
  compensationNotes?: string
  documents: EmployeeDocument[]
}

export function extractEditableFields(profile: EmployeeProfile): EmployeeEditableFields {
  return {
    employeeNumber: profile.employment.employeeNumber,
    hireDate: profile.employment.hireDate,
    probationEndDate: profile.employment.probationEndDate,
    employmentType: profile.employment.employmentType,
    contractType: profile.employment.contractType,
    department: profile.employment.department,
    position: profile.employment.position,
    branch: profile.employment.branch,
    company: profile.employment.company,
    managerId: profile.employment.managerId,
    managerName: profile.employment.managerName,
    workSchedule: profile.employment.workSchedule,
    workLocationType: profile.employment.workLocationType,
    workLocation: profile.employment.workLocation,
    personal: profile.personal,
    labourLaw: profile.labourLaw,
    bankName: profile.payroll.bankName,
    bankAccountNumber: profile.payroll.bankAccountNumber,
    baseSalary: profile.payroll.baseSalary,
    currency: profile.payroll.currency,
    bonus: profile.payroll.bonus,
    compensationNotes: profile.payroll.compensationNotes,
    documents: profile.documents,
  }
}

export interface FieldChange {
  field: keyof EmployeeEditableFields
  oldValue: unknown
  newValue: unknown
}

/**
 * Per-field, deep-by-value comparison between the record as it existed
 * before an edit and the values the wizard is about to save. Every entry
 * here is exactly the shape a future Audit module would need to write one
 * log entry per changed field — computed and available even though nothing
 * consumes it yet.
 */
export function diffEmployeeFields(
  existing: EmployeeEditableFields,
  next: EmployeeEditableFields
): FieldChange[] {
  const changes: FieldChange[] = []
  for (const key of Object.keys(existing) as (keyof EmployeeEditableFields)[]) {
    const oldValue = existing[key]
    const newValue = next[key]
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({ field: key, oldValue, newValue })
    }
  }
  return changes
}

/**
 * Reconciles the Documents step's resubmitted list against what was
 * already stored: a document whose id already existed keeps its original
 * uploadedAt/fileSize (editing an unrelated field must not reset it), a
 * genuinely new id is stamped fresh — the same stamping create already
 * does in wizardDataToProfile.
 */
export function mergeDocuments(
  existingDocuments: EmployeeDocument[],
  draftDocuments: EmployeeDocument[]
): EmployeeDocument[] {
  const today = new Date().toISOString().slice(0, 10)
  return draftDocuments.map((doc) => {
    const original = existingDocuments.find((existing) => existing.id === doc.id)
    return original
      ? { ...doc, uploadedAt: original.uploadedAt, fileSize: original.fileSize }
      : { ...doc, uploadedAt: today, fileSize: "—" }
  })
}

/**
 * Applies only the wizard-editable fields onto a full profile. Every other
 * section — leave, education, assets, notes, auditLog, quickStats,
 * employmentStatus, id, employment.grade/history, payroll.allowances —
 * passes through unchanged via the spreads below.
 */
export function applyEditableFields(
  profile: EmployeeProfile,
  next: EmployeeEditableFields
): EmployeeProfile {
  return {
    ...profile,
    employment: {
      ...profile.employment,
      employeeNumber: next.employeeNumber,
      hireDate: next.hireDate,
      probationEndDate: next.probationEndDate,
      employmentType: next.employmentType,
      contractType: next.contractType,
      department: next.department,
      position: next.position,
      branch: next.branch,
      company: next.company,
      managerId: next.managerId,
      managerName: next.managerName,
      workSchedule: next.workSchedule,
      workLocationType: next.workLocationType,
      workLocation: next.workLocation,
    },
    personal: next.personal,
    labourLaw: next.labourLaw,
    payroll: {
      ...profile.payroll,
      bankName: next.bankName,
      bankAccountNumber: next.bankAccountNumber,
      baseSalary: next.baseSalary,
      currency: next.currency,
      bonus: next.bonus,
      compensationNotes: next.compensationNotes,
    },
    documents: next.documents,
  }
}
