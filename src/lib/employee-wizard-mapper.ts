import type { EmployeeProfile } from "@/types/employee-profile"
import type { EmployeeWizardData } from "@/types/employee-wizard"

export const CUSTOM_WORK_SCHEDULE_ID = "custom"

/**
 * The master-data lookups the mapper needs, resolved once (server-side, via
 * the Administration repositories) and passed down through the wizard as
 * plain props. The wizard never queries the database itself — it only ever
 * reads the snapshot the page already fetched — and this mapper stays a
 * pure function with no server-only imports, so it can run in the browser
 * where the wizard's own submit handler lives.
 */
export interface WizardMasterData {
  departments: { id: string; name: string }[]
  positions: { id: string; title: string; departmentId: string }[]
  companies: { id: string; name: string }[]
  branches: { id: string; name: string; companyId: string }[]
  workSchedules: { id: string; label: string }[]
  managers: { id: string; name: string }[]
}

/**
 * Maps the flat wizard form state onto the master EmployeeProfile record.
 *
 * The wizard stores master-data selections (department, position, company,
 * branch, work schedule, manager) by id, never by name — see
 * types/employee-wizard.ts. EmployeeProfile.employment, however, still
 * stores plain display strings (department/position/branch/company/
 * workSchedule/managerName), because every other module (Employee List,
 * Cards, Filters, Profile tabs) reads those as strings and none of that is
 * in scope to change right now. This function is the one place that
 * resolves ids to their current display value, so the rest of the app
 * never needs to know the wizard is id-driven internally.
 *
 * The wizard also collects no education/assets/notes step yet, so those
 * sections start empty and are expected to be filled in later from the
 * Employee Profile page.
 */
export function wizardDataToProfile(data: EmployeeWizardData, masterData: WizardMasterData): EmployeeProfile {
  const id = data.employeeNumber.trim()
  const now = new Date().toISOString()

  const department = masterData.departments.find((d) => d.id === data.departmentId)
  const position = masterData.positions.find((p) => p.id === data.positionId)
  const company = masterData.companies.find((c) => c.id === data.companyId)
  const branch = masterData.branches.find((b) => b.id === data.branchId)
  const schedule = masterData.workSchedules.find((s) => s.id === data.scheduleId)
  const manager = masterData.managers.find((m) => m.id === data.managerId)

  const departmentName = department?.name ?? ""
  const positionTitle = position?.title ?? ""
  const workScheduleLabel =
    data.scheduleId === CUSTOM_WORK_SCHEDULE_ID
      ? data.customWorkScheduleLabel
      : (schedule?.label ?? "")

  return {
    id,
    employmentStatus: data.probationEndDate ? "probation" : "active",
    employment: {
      employeeNumber: data.employeeNumber.trim(),
      hireDate: data.hireDate,
      probationEndDate: data.probationEndDate || undefined,
      employmentType: data.employmentType || "full-time",
      contractType: data.contractType || "permanent",
      department: departmentName,
      position: positionTitle,
      grade: "",
      branch: branch?.name ?? "",
      company: company?.name ?? "",
      managerId: data.managerId || undefined,
      managerName: manager?.name || undefined,
      workSchedule: workScheduleLabel,
      workLocationType: data.workLocationType || "on-site",
      workLocation: data.workLocation,
      history: [
        {
          id: `EH-${id}-1`,
          date: data.hireDate,
          type: "hire",
          title: `Hired as ${positionTitle}`,
          description: `Joined the ${departmentName} team.`,
        },
      ],
    },
    personal: {
      firstName: data.firstName,
      lastName: data.lastName,
      fatherName: data.fatherName || undefined,
      photoUrl: data.photoUrl || undefined,
      gender: data.gender || "male",
      dateOfBirth: data.dateOfBirth,
      nationality: data.nationality,
      maritalStatus: data.maritalStatus || "single",
      finCode: data.finCode,
      nationalId: data.nationalId,
      idIssuingAuthority: data.idIssuingAuthority || undefined,
      idIssueDate: data.idIssueDate || undefined,
      idExpiryDate: data.idExpiryDate || undefined,
      passportNumber: data.passportNumber,
      address: data.address,
      phone: data.phone,
      email: data.email,
      emergencyContactName: data.emergencyContactName,
      emergencyContactPhone: data.emergencyContactPhone,
      emergencyContactRelation: data.emergencyContactRelation,
    },
    labourLaw: {
      isPregnant: data.isPregnant,
      isSingleParent: data.isSingleParent,
      isAdoptiveParent: data.isAdoptiveParent,
      children: data.children,
      hasDisability: data.hasDisability,
      disabilityGroup: data.disabilityGroup || undefined,
      disabilityCause: data.disabilityCause || undefined,
      disabilityCertificateExpiryDate: data.disabilityCertificateExpiryDate || undefined,
      veteranStatus: data.veteranStatus || undefined,
      stateDecorationName: data.stateDecorationName || undefined,
      professionalCategory: data.professionalCategory || undefined,
      hazardousWork: data.hazardousWork,
      undergroundWork: data.undergroundWork,
      nightShiftWork: data.nightShiftWork,
      isShiftWork: data.isShiftWork,
      workingConditionsNotes: data.workingConditionsNotes || undefined,
      previousWorkExperience: data.previousWorkExperience,
      hasCollectiveAgreementLeave: data.hasCollectiveAgreementLeave,
      collectiveAgreementLeaveDays: data.collectiveAgreementLeaveDays,
      companyAdditionalLeaveDays: data.companyAdditionalLeaveDays,
      manualLeaveAdjustmentDays: data.manualLeaveAdjustmentDays || undefined,
      notes: data.labourLawNotes || undefined,
    },
    leave: {
      annualLeaveEntitlement: 21,
      additionalLeaveEntitlement: 0,
      usedLeaveDays: 0,
      remainingLeaveDays: 21,
      history: [],
    },
    payroll: {
      bankName: data.bankName,
      bankAccountNumber: data.bankAccountNumber,
      baseSalary: Number(data.baseSalary) || 0,
      currency: data.currency,
      bonus: data.bonus,
      allowances: [],
      compensationNotes: data.compensationNotes || undefined,
    },
    documents: data.documents.map((doc) => ({
      id: doc.id,
      category: doc.category,
      name: doc.name,
      uploadedAt: now.slice(0, 10),
      fileSize: "—",
    })),
    education: { schools: [], universities: [], certificates: [], languages: [], skills: [] },
    assets: [],
    notes: [],
    auditLog: [
      {
        id: `AUD-${id}-1`,
        timestamp: now,
        actor: "System",
        action: "record.created",
      },
    ],
    quickStats: { tenureYears: 0, directReports: 0, completedTrainings: 0, openTasks: 0 },
  }
}

/**
 * The reverse of wizardDataToProfile — pre-fills the wizard's form state
 * from an existing EmployeeProfile so the same wizard can be reused for
 * editing. Personal/Labour Law/Payroll map back 1:1 (the wizard covers
 * every field in those sections). Department/Position/Company/Branch/Work
 * Schedule are the one lossy spot: EmployeeProfile.employment only stores
 * their display name/title/label, not the id it came from, so the id has
 * to be recovered by matching that text against the current master-data
 * snapshot (position additionally scoped by the resolved department,
 * branch by the resolved company). If a match isn't found — the
 * department/position/branch/etc. was renamed or archived since this
 * employee was hired — the field comes back empty rather than guessing,
 * and a work schedule with no matching label is treated as a custom one.
 */
export function profileToWizardData(
  profile: EmployeeProfile,
  masterData: WizardMasterData
): EmployeeWizardData {
  const department = masterData.departments.find((d) => d.name === profile.employment.department)
  const position = masterData.positions.find(
    (p) => p.title === profile.employment.position && (!department || p.departmentId === department.id)
  )
  const company = masterData.companies.find((c) => c.name === profile.employment.company)
  const branch = masterData.branches.find(
    (b) => b.name === profile.employment.branch && (!company || b.companyId === company.id)
  )
  const schedule = masterData.workSchedules.find((s) => s.label === profile.employment.workSchedule)

  return {
    photoUrl: profile.personal.photoUrl ?? "",
    firstName: profile.personal.firstName,
    lastName: profile.personal.lastName,
    fatherName: profile.personal.fatherName ?? "",
    gender: profile.personal.gender,
    dateOfBirth: profile.personal.dateOfBirth,
    nationality: profile.personal.nationality,
    maritalStatus: profile.personal.maritalStatus,
    finCode: profile.personal.finCode,
    nationalId: profile.personal.nationalId,
    idIssuingAuthority: profile.personal.idIssuingAuthority ?? "",
    idIssueDate: profile.personal.idIssueDate ?? "",
    idExpiryDate: profile.personal.idExpiryDate ?? "",
    passportNumber: profile.personal.passportNumber,
    address: profile.personal.address,
    phone: profile.personal.phone,
    email: profile.personal.email,
    emergencyContactName: profile.personal.emergencyContactName,
    emergencyContactPhone: profile.personal.emergencyContactPhone,
    emergencyContactRelation: profile.personal.emergencyContactRelation,

    employeeNumber: profile.employment.employeeNumber,
    hireDate: profile.employment.hireDate,
    probationEndDate: profile.employment.probationEndDate ?? "",
    employmentType: profile.employment.employmentType,
    contractType: profile.employment.contractType,
    departmentId: department?.id ?? "",
    positionId: position?.id ?? "",
    companyId: company?.id ?? "",
    branchId: branch?.id ?? "",
    managerId: profile.employment.managerId ?? "",
    scheduleId: schedule ? schedule.id : profile.employment.workSchedule ? CUSTOM_WORK_SCHEDULE_ID : "",
    customWorkScheduleLabel: schedule ? "" : profile.employment.workSchedule,
    workLocationType: profile.employment.workLocationType,
    workLocation: profile.employment.workLocation,

    isPregnant: profile.labourLaw.isPregnant,
    isSingleParent: profile.labourLaw.isSingleParent,
    isAdoptiveParent: profile.labourLaw.isAdoptiveParent,
    children: profile.labourLaw.children,
    hasDisability: profile.labourLaw.hasDisability,
    disabilityGroup: profile.labourLaw.disabilityGroup ?? "",
    disabilityCause: profile.labourLaw.disabilityCause ?? "",
    disabilityCertificateExpiryDate: profile.labourLaw.disabilityCertificateExpiryDate ?? "",
    veteranStatus: profile.labourLaw.veteranStatus ?? "",
    stateDecorationName: profile.labourLaw.stateDecorationName ?? "",
    professionalCategory: profile.labourLaw.professionalCategory ?? "",
    hazardousWork: profile.labourLaw.hazardousWork,
    undergroundWork: profile.labourLaw.undergroundWork,
    nightShiftWork: profile.labourLaw.nightShiftWork,
    isShiftWork: profile.labourLaw.isShiftWork,
    workingConditionsNotes: profile.labourLaw.workingConditionsNotes ?? "",
    previousWorkExperience: profile.labourLaw.previousWorkExperience,
    hasCollectiveAgreementLeave: profile.labourLaw.hasCollectiveAgreementLeave,
    collectiveAgreementLeaveDays: profile.labourLaw.collectiveAgreementLeaveDays ?? 0,
    companyAdditionalLeaveDays: profile.labourLaw.companyAdditionalLeaveDays,
    manualLeaveAdjustmentDays: profile.labourLaw.manualLeaveAdjustmentDays ?? 0,
    labourLawNotes: profile.labourLaw.notes ?? "",

    bankName: profile.payroll.bankName,
    bankAccountNumber: profile.payroll.bankAccountNumber,
    baseSalary: profile.payroll.baseSalary,
    currency: profile.payroll.currency,
    bonus: profile.payroll.bonus,
    compensationNotes: profile.payroll.compensationNotes ?? "",

    documents: profile.documents.map((doc) => ({ id: doc.id, name: doc.name, category: doc.category })),
  }
}
