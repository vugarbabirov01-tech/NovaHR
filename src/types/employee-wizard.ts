import type {
  ContractType,
  DisabilityGroup,
  DocumentCategory,
  EmployeeChild,
  EmploymentType,
  Gender,
  MaritalStatus,
  ProfessionalCategory,
  VeteranStatus,
  WorkExperienceDuration,
  WorkLocationType,
} from "@/types/employee-profile"

export interface WizardDocument {
  id: string
  name: string
  category: DocumentCategory
}

export interface EmployeeWizardData {
  // Step 1 — Personal Information
  photoUrl: string
  firstName: string
  lastName: string
  fatherName: string
  gender: Gender | ""
  dateOfBirth: string
  nationality: string
  maritalStatus: MaritalStatus | ""
  finCode: string
  nationalId: string
  idIssuingAuthority: string
  idIssueDate: string
  idExpiryDate: string
  passportNumber: string
  address: string
  phone: string
  email: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelation: string

  // Step 2 — Employment. Department/Position/Company/Branch/WorkSchedule are
  // all master-data references stored by id — never free text — resolved to
  // their display values only at the moment the profile is created.
  employeeNumber: string
  hireDate: string
  probationEndDate: string
  employmentType: EmploymentType | ""
  contractType: ContractType | ""
  departmentId: string
  positionId: string
  companyId: string
  branchId: string
  managerId: string
  scheduleId: string
  customWorkScheduleLabel: string
  workLocationType: WorkLocationType | ""
  workLocation: string

  // Step 3 — Labour Law. "Minor" and "retirement age" are intentionally not
  // part of this form state — both are derived from dateOfBirth (and gender,
  // for retirement age) above and computed on demand wherever they're
  // displayed, never entered or stored. See @/lib/employees.
  isPregnant: boolean
  isSingleParent: boolean
  isAdoptiveParent: boolean
  children: EmployeeChild[]
  hasDisability: boolean
  disabilityGroup: DisabilityGroup | ""
  disabilityCause: string
  disabilityCertificateExpiryDate: string
  veteranStatus: VeteranStatus | ""
  stateDecorationName: string
  professionalCategory: ProfessionalCategory | ""
  hazardousWork: boolean
  undergroundWork: boolean
  nightShiftWork: boolean
  isShiftWork: boolean
  workingConditionsNotes: string
  // Only the pre-employment portion is entered here. Company Service
  // Duration and Total Work Experience are always computed from this plus
  // hireDate above — see calculateServiceDuration / addDurations in
  // @/lib/employees — and are never part of the wizard's own form state.
  previousWorkExperience: WorkExperienceDuration
  hasCollectiveAgreementLeave: boolean
  collectiveAgreementLeaveDays: number
  companyAdditionalLeaveDays: number
  manualLeaveAdjustmentDays: number
  labourLawNotes: string

  // Step 4 — Payroll
  bankName: string
  bankAccountNumber: string
  // "" means "not entered yet" — kept distinct from 0 so the field can
  // render genuinely empty instead of a number input snapping back to "0"
  // the instant it's cleared. See payroll-step.tsx.
  baseSalary: number | ""
  currency: string
  bonus: number
  compensationNotes: string
  /** ISO date (YYYY-MM-DD) this base salary took effect — "" means unknown/not entered. */
  salaryEffectiveDate: string

  // Step 5 — Documents
  documents: WizardDocument[]
}

export const defaultWizardData: EmployeeWizardData = {
  photoUrl: "",
  firstName: "",
  lastName: "",
  fatherName: "",
  gender: "",
  dateOfBirth: "",
  nationality: "",
  maritalStatus: "",
  finCode: "",
  nationalId: "",
  idIssuingAuthority: "",
  idIssueDate: "",
  idExpiryDate: "",
  passportNumber: "",
  address: "",
  phone: "",
  email: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",

  employeeNumber: "",
  hireDate: "",
  probationEndDate: "",
  employmentType: "",
  contractType: "",
  departmentId: "",
  positionId: "",
  companyId: "",
  branchId: "",
  managerId: "",
  scheduleId: "",
  customWorkScheduleLabel: "",
  workLocationType: "",
  workLocation: "",

  isPregnant: false,
  isSingleParent: false,
  isAdoptiveParent: false,
  children: [],
  hasDisability: false,
  disabilityGroup: "",
  disabilityCause: "",
  disabilityCertificateExpiryDate: "",
  veteranStatus: "",
  stateDecorationName: "",
  professionalCategory: "",
  hazardousWork: false,
  undergroundWork: false,
  nightShiftWork: false,
  isShiftWork: false,
  workingConditionsNotes: "",
  previousWorkExperience: { years: 0, months: 0, days: 0 },
  hasCollectiveAgreementLeave: false,
  collectiveAgreementLeaveDays: 0,
  companyAdditionalLeaveDays: 0,
  manualLeaveAdjustmentDays: 0,
  labourLawNotes: "",

  bankName: "",
  bankAccountNumber: "",
  baseSalary: "",
  currency: "AZN",
  bonus: 0,
  compensationNotes: "",
  salaryEffectiveDate: "",

  documents: [],
}
