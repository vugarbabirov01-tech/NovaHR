// Employee Master Record — the structured data model backing the Employee
// module (list, profile, creation wizard). Every other HRMS module (Leave,
// Payroll, Attendance, Performance, Recruitment, Assets, Training, Reports)
// is expected to read from this shape, so fields are grouped by the legal /
// operational concern that owns them rather than by UI convenience.

export type EmploymentStatus =
  | "active"
  | "probation"
  | "on-leave"
  | "suspended"
  | "terminated"
  | "inactive"

export type EmploymentType =
  | "full-time"
  | "part-time"
  | "seasonal"
  | "temporary"
  | "contract"
  | "internship"

export type ContractType =
  | "permanent"
  | "fixed-term"
  | "project-based"
  | "internship"

export type WorkLocationType = "on-site" | "remote" | "hybrid"

export type Gender = "male" | "female"

export type MaritalStatus = "single" | "married" | "divorced" | "widowed"

export type DisabilityGroup = "I" | "II" | "III"

export type VeteranStatus =
  | "warVeteran"
  | "combatParticipant"
  | "liberatedTerritoriesSpecialist"
  | "stateDecorationHolder"

export type ProfessionalCategory =
  | "civilServant"
  | "judge"
  | "prosecutor"
  | "academicStaff"
  | "medicalStaff"

export type LanguageProficiency =
  | "basic"
  | "conversational"
  | "fluent"
  | "native"

export type DocumentCategory =
  | "national-id"
  | "contract"
  | "certificate"
  | "diploma"
  | "medical"
  | "military"
  | "other"

export type AssetCategory =
  | "laptop"
  | "phone"
  | "vehicle"
  | "uniform"
  | "access-card"
  | "equipment"

export type AssetStatus = "assigned" | "returned" | "lost" | "damaged"

export type LeaveRequestStatus = "approved" | "pending" | "rejected"

export type EmploymentHistoryEventType =
  | "hire"
  | "promotion"
  | "transfer"
  | "salary-change"
  | "status-change"
  | "contract-renewal"
  | "termination"
  | "rehire"

// ---------------------------------------------------------------------------
// List / card view summary — the slice shown without opening a profile.
// ---------------------------------------------------------------------------

export interface EmployeeListItem {
  id: string
  employeeNumber: string
  finCode: string
  firstName: string
  lastName: string
  photoUrl?: string
  email: string
  phone: string
  company: string
  department: string
  position: string
  branch: string
  workLocation: string
  managerId?: string
  managerName?: string
  employmentType: EmploymentType
  employmentStatus: EmploymentStatus
  hireDate: string
}

// ---------------------------------------------------------------------------
// 2. Employment
// ---------------------------------------------------------------------------

export interface EmploymentHistoryEvent {
  id: string
  date: string
  type: EmploymentHistoryEventType
  title: string
  description: string
}

export interface EmployeeEmployment {
  employeeNumber: string
  hireDate: string
  probationEndDate?: string
  employmentType: EmploymentType
  contractType: ContractType
  department: string
  position: string
  grade: string
  branch: string
  company: string
  managerId?: string
  managerName?: string
  workSchedule: string
  workLocationType: WorkLocationType
  workLocation: string
  history: EmploymentHistoryEvent[]
}

// ---------------------------------------------------------------------------
// 3. Personal Information
// ---------------------------------------------------------------------------

export interface EmployeePersonal {
  firstName: string
  lastName: string
  fatherName?: string
  gender: Gender
  dateOfBirth: string
  nationality: string
  maritalStatus: MaritalStatus
  finCode: string
  nationalId: string
  idIssuingAuthority?: string
  idIssueDate?: string
  idExpiryDate?: string
  passportNumber: string
  address: string
  phone: string
  email: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelation: string
  photoUrl?: string
}

// ---------------------------------------------------------------------------
// 4. Labour Law — Azerbaijan Labour Code factors. Every field here is a raw,
// structured input; nothing is calculated. Leave/Payroll modules are meant
// to derive entitlements from this data later without schema changes.
// ---------------------------------------------------------------------------

export interface WorkExperienceDuration {
  years: number
  months: number
  days: number
}

export interface EmployeeChild {
  id: string
  fullName: string
  dateOfBirth: string
  hasDisability: boolean
  disabilityCertificateExpiryDate?: string
}

// ---------------------------------------------------------------------------
// Labour Law — Azerbaijan Labour Code factors. Every field here is a raw,
// structured input; nothing is calculated. Leave/Payroll modules are meant
// to derive entitlements from this data later without schema changes.
//
// "Minor" and "retirement age" are deliberately absent from this interface —
// both are derived legal statuses computed from Personal step's dateOfBirth
// (and gender, for retirement age), never stored, so they can never drift
// out of sync with the employee's actual age or a legislative change. See
// calculateAgeFromDateOfBirth / isMinorFromDateOfBirth /
// isRetirementAgeFromDateOfBirth in @/lib/employees.
// ---------------------------------------------------------------------------

export interface EmployeeLabourLaw {
  // Family
  isPregnant: boolean
  isSingleParent: boolean
  isAdoptiveParent: boolean
  children: EmployeeChild[]

  // Disability
  hasDisability: boolean
  disabilityGroup?: DisabilityGroup
  disabilityCause?: string
  disabilityCertificateExpiryDate?: string

  // Veteran / special service status (Labour Code Art. 118/120 categories)
  veteranStatus?: VeteranStatus
  stateDecorationName?: string

  // Professional category — several sectors carry statutory leave baselines
  // that differ from the general Labour Code minimum (judges, prosecutors,
  // civil servants, academic and medical staff)
  professionalCategory?: ProfessionalCategory

  // Working conditions affecting leave / working-time rules
  hazardousWork: boolean
  undergroundWork: boolean
  nightShiftWork: boolean
  isShiftWork: boolean
  workingConditionsNotes?: string

  // Experience (drives length-of-service additional leave, Art. 116). Only
  // the pre-employment portion is stored — company service duration and the
  // combined total are always derived from employment.hireDate +
  // previousWorkExperience, never persisted. See calculateServiceDuration /
  // addDurations in @/lib/employees.
  previousWorkExperience: WorkExperienceDuration

  // Additional leave entitlement sources, stored ahead of the future Leave
  // module so nothing needs to be re-collected when automation ships
  hasCollectiveAgreementLeave: boolean
  collectiveAgreementLeaveDays?: number
  companyAdditionalLeaveDays: number
  manualLeaveAdjustmentDays?: number

  notes?: string
}

// ---------------------------------------------------------------------------
// 5. Leave Information — placeholders only; to be computed from Labour Law
// data by the future Leave module.
// ---------------------------------------------------------------------------

export interface LeaveHistoryEntry {
  id: string
  type: string
  startDate: string
  endDate: string
  days: number
  status: LeaveRequestStatus
}

export interface EmployeeLeave {
  annualLeaveEntitlement: number
  additionalLeaveEntitlement: number
  usedLeaveDays: number
  remainingLeaveDays: number
  history: LeaveHistoryEntry[]
}

// ---------------------------------------------------------------------------
// 6. Payroll
// ---------------------------------------------------------------------------

export interface PayrollAllowance {
  id: string
  label: string
  amount: number
}

export interface EmployeePayroll {
  bankName: string
  bankAccountNumber: string
  baseSalary: number
  currency: string
  bonus: number
  allowances: PayrollAllowance[]
  compensationNotes?: string
}

// ---------------------------------------------------------------------------
// 7. Documents
// ---------------------------------------------------------------------------

export interface EmployeeDocument {
  id: string
  category: DocumentCategory
  name: string
  uploadedAt: string
  fileSize: string
}

// ---------------------------------------------------------------------------
// 8. Education
// ---------------------------------------------------------------------------

export interface EducationEntry {
  id: string
  institution: string
  degree?: string
  fieldOfStudy?: string
  startYear: number
  endYear?: number
}

export interface CertificateEntry {
  id: string
  name: string
  issuer: string
  issueDate: string
  expiryDate?: string
}

export interface LanguageSkill {
  id: string
  language: string
  proficiency: LanguageProficiency
}

export interface EmployeeEducation {
  schools: EducationEntry[]
  universities: EducationEntry[]
  certificates: CertificateEntry[]
  languages: LanguageSkill[]
  skills: string[]
}

// ---------------------------------------------------------------------------
// 9. Assets
// ---------------------------------------------------------------------------

export interface EmployeeAsset {
  id: string
  category: AssetCategory
  name: string
  assetTag: string
  assignedDate: string
  returnedDate?: string
  status: AssetStatus
}

// ---------------------------------------------------------------------------
// 10. Notes
// ---------------------------------------------------------------------------

export interface EmployeeNote {
  id: string
  author: string
  date: string
  content: string
}

// ---------------------------------------------------------------------------
// 11. Audit Log
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  field?: string
  oldValue?: string
  newValue?: string
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

export interface EmployeeQuickStats {
  tenureYears: number
  directReports: number
  completedTrainings: number
  openTasks: number
}

// ---------------------------------------------------------------------------
// The full master record
// ---------------------------------------------------------------------------

export interface EmployeeProfile {
  id: string
  employmentStatus: EmploymentStatus
  employment: EmployeeEmployment
  personal: EmployeePersonal
  labourLaw: EmployeeLabourLaw
  leave: EmployeeLeave
  payroll: EmployeePayroll
  documents: EmployeeDocument[]
  education: EmployeeEducation
  assets: EmployeeAsset[]
  notes: EmployeeNote[]
  auditLog: AuditLogEntry[]
  quickStats: EmployeeQuickStats
}

export function toListItem(profile: EmployeeProfile): EmployeeListItem {
  return {
    id: profile.id,
    employeeNumber: profile.employment.employeeNumber,
    finCode: profile.personal.finCode,
    firstName: profile.personal.firstName,
    lastName: profile.personal.lastName,
    photoUrl: profile.personal.photoUrl,
    email: profile.personal.email,
    phone: profile.personal.phone,
    company: profile.employment.company,
    department: profile.employment.department,
    position: profile.employment.position,
    branch: profile.employment.branch,
    workLocation: profile.employment.workLocation,
    managerId: profile.employment.managerId,
    managerName: profile.employment.managerName,
    employmentType: profile.employment.employmentType,
    employmentStatus: profile.employmentStatus,
    hireDate: profile.employment.hireDate,
  }
}
