import { resolveAnnualLeaveEntitlement } from "@/lib/leave/leave-policy-resolution-service"
import {
  cleanText,
  parseDisability,
  parseEmasDate,
  parseExperience,
  parseGross,
  parseLeave,
  splitFullName,
  type EmasCell,
} from "@/lib/emas-sync/parse"
import type { AuditLogEntry, EmployeeProfile, PreviousEmployment } from "@/types/employee-profile"

/** One row of the "Əvvəlki staj" sheet, keyed by its header text. */
export type EmasRow = Record<string, EmasCell>
/** One row of the "Detallı dövrlər" sheet. */
export type EmasDetailRow = Record<string, EmasCell>

/** The employer's own VÖEN — its contracts are not "previous employment". */
export const OWN_COMPANY_TAX_ID = "1301709881"

export const EMAS_ACTOR = "ƏMAS sinxronu"

export const COL = {
  fullName: "Ad, soyad, ata adı",
  hireDate: "İşə qəbul tarixi",
  experience: "Ümumi əvvəlki staj (il, ay, gün)",
  nationalId: "Şəxsiyyət vəsiqəsinin seriyası və nömrəsi",
  fin: "FİN kod",
  idIssueDate: "Şəxsiyyət vəsiqəsinin verilmə tarixi",
  idIssuedBy: "Şəxsiyyət vəsiqəsini verən orqan",
  dob: "Doğum tarixi (təvəllüd)",
  actualAddress: "Faktiki yaşayış ünvanı",
  registrationAddress: "Qeydiyyat ünvanı (şəxsiyyət vəsiqəsi üzrə)",
  phone: "Əlaqə nömrəsi",
  ssn: "Sosial sığorta nömrəsi (SSN)",
  disability: "Əlillik dərəcəsi",
  gross: "Əmək haqqı (AZN)",
  position: "Vəzifəsi",
  veteran: "Müharibə veteranı statusu",
  martyr: "Şəhid ailəsi statusu",
  leave: "İllik əmək məzuniyyəti günləri",
  workSchedule: "İş qrafiki (iş günləri və saatları)",
} as const

export const DETAIL_COL = {
  fin: "FİN",
  organization: "Qurum",
  taxId: "VÖEN",
  position: "Vəzifə",
  start: "Başlama tarixi (ƏMAS)",
  end: "Xitam tarixi (ƏMAS)",
  counted: "Hesaba alınıb?",
  note: "Qeyd",
} as const

export interface FieldChange {
  field: string
  oldValue: string
  newValue: string
}

export interface SyncResult {
  profile: EmployeeProfile
  changes: FieldChange[]
  /** ƏMAS total vs the Leave module's own total, for the report. */
  leaveComparison?: { emasTotal: number; novaTotal: number }
}

/** True when ƏMAS has a live contract row for this person (the 2 "Diqqət" rows have none). */
export function hasEmasContract(row: EmasRow): boolean {
  return cleanText(row[COL.position]) !== undefined
}

export function buildPreviousEmployments(finCode: string, details: EmasDetailRow[]): PreviousEmployment[] {
  const out: PreviousEmployment[] = []
  details.forEach((detail, index) => {
    if (cleanText(detail[DETAIL_COL.fin])?.toUpperCase() !== finCode.toUpperCase()) return
    const taxId = cleanText(detail[DETAIL_COL.taxId])
    if (taxId === OWN_COMPANY_TAX_ID) return
    const startDate = parseEmasDate(detail[DETAIL_COL.start])
    const endDate = parseEmasDate(detail[DETAIL_COL.end])
    // ƏMAS never guessed a missing date, and neither do we — such a row has
    // no period to show.
    if (!startDate || !endDate) return
    const organization = cleanText(detail[DETAIL_COL.organization])
    if (!organization) return
    const counted = cleanText(detail[DETAIL_COL.counted]) === "Bəli"
    out.push({
      id: `PE-${finCode.toUpperCase()}-${index + 1}`,
      organization,
      taxId,
      position: cleanText(detail[DETAIL_COL.position]),
      startDate,
      endDate,
      counted,
      note: cleanText(detail[DETAIL_COL.note]),
    })
  })
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate))
}

const show = (value: unknown): string =>
  value === undefined || value === null || value === "" ? "—" : typeof value === "string" ? value : JSON.stringify(value)

/**
 * Applies the agreed ƏMAS rules to one profile and returns the updated copy
 * plus a per-field change list (also appended to auditLog). Pure: no I/O,
 * never mutates its input.
 *
 * Rules (2026-11-13): ƏMAS wins over Nova, except a non-empty Nova phone
 * and the Nova address are kept; the ID-card address goes to its own field;
 * net salary (baseSalary) is never touched.
 */
export function computeSync(
  existing: EmployeeProfile,
  row: EmasRow,
  details: EmasDetailRow[],
  now: Date = new Date()
): SyncResult {
  const profile: EmployeeProfile = structuredClone(existing)
  const changes: FieldChange[] = []
  const record = (field: string, oldValue: unknown, newValue: unknown) =>
    changes.push({ field, oldValue: show(oldValue), newValue: show(newValue) })

  const finCode = existing.personal.finCode

  const dob = parseEmasDate(row[COL.dob])
  if (dob && dob !== profile.personal.dateOfBirth) {
    record("personal.dateOfBirth", profile.personal.dateOfBirth, dob)
    profile.personal.dateOfBirth = dob
  }

  const textFields: [string, keyof typeof profile.personal, string | undefined][] = [
    ["personal.nationalId", "nationalId", cleanText(row[COL.nationalId])],
    ["personal.idIssueDate", "idIssueDate", parseEmasDate(row[COL.idIssueDate])],
    ["personal.idIssuingAuthority", "idIssuingAuthority", cleanText(row[COL.idIssuedBy])],
    ["personal.socialInsuranceNumber", "socialInsuranceNumber", cleanText(row[COL.ssn])],
    ["personal.registrationAddress", "registrationAddress", cleanText(row[COL.registrationAddress])],
  ]
  for (const [label, key, value] of textFields) {
    if (value && value !== profile.personal[key]) {
      record(label, profile.personal[key], value)
      ;(profile.personal as unknown as Record<string, unknown>)[key] = value
    }
  }

  // Kept as agreed: a filled Nova phone / address is never replaced.
  const phone = cleanText(row[COL.phone])
  if (phone && !profile.personal.phone?.trim()) {
    record("personal.phone", profile.personal.phone, phone)
    profile.personal.phone = phone
  }
  const actualAddress = cleanText(row[COL.actualAddress])
  if (actualAddress && !profile.personal.address?.trim()) {
    record("personal.address", profile.personal.address, actualAddress)
    profile.personal.address = actualAddress
  }

  const position = cleanText(row[COL.position])
  if (position && position !== profile.employment.position) {
    record("employment.position", profile.employment.position, position)
    profile.employment.position = position
  }

  const hireDate = parseEmasDate(row[COL.hireDate])
  if (hireDate && hireDate !== profile.employment.hireDate) {
    const previous = profile.employment.hireDate
    record("employment.hireDate", previous, hireDate)
    profile.employment.hireDate = hireDate
    const hireEvent = profile.employment.history.find((e) => e.type === "hire" && e.date === previous)
    if (hireEvent) hireEvent.date = hireDate
  }

  const gross = parseGross(row[COL.gross])
  if (gross !== undefined && gross !== profile.payroll.grossSalary) {
    record("payroll.grossSalary", profile.payroll.grossSalary, gross)
    profile.payroll.grossSalary = gross
  }

  const experience = parseExperience(row[COL.experience])
  const currentExperience = profile.labourLaw.previousWorkExperience
  if (
    experience &&
    (experience.years !== currentExperience?.years ||
      experience.months !== currentExperience?.months ||
      experience.days !== currentExperience?.days)
  ) {
    record(
      "labourLaw.previousWorkExperience",
      currentExperience ? `${currentExperience.years}/${currentExperience.months}/${currentExperience.days}` : undefined,
      `${experience.years}/${experience.months}/${experience.days}`
    )
    profile.labourLaw.previousWorkExperience = experience
  }

  const jobs = buildPreviousEmployments(finCode, details)
  if (jobs.length > 0 && JSON.stringify(jobs) !== JSON.stringify(profile.labourLaw.previousEmployments ?? [])) {
    record("labourLaw.previousEmployments", `${profile.labourLaw.previousEmployments?.length ?? 0} yer`, `${jobs.length} yer`)
    profile.labourLaw.previousEmployments = jobs
  }

  const disability = parseDisability(row[COL.disability])
  if (disability) {
    const sameGroup = profile.labourLaw.hasDisability && profile.labourLaw.disabilityGroup === disability.group
    if (!sameGroup) {
      record(
        "labourLaw.disabilityGroup",
        profile.labourLaw.hasDisability ? profile.labourLaw.disabilityGroup : undefined,
        disability.group
      )
      profile.labourLaw.hasDisability = true
      profile.labourLaw.disabilityGroup = disability.group
    }
    if (disability.cause && disability.cause !== profile.labourLaw.disabilityCause) {
      record("labourLaw.disabilityCause", profile.labourLaw.disabilityCause, disability.cause)
      profile.labourLaw.disabilityCause = disability.cause
    }
  }

  if (cleanText(row[COL.veteran])?.startsWith("Bəli") && profile.labourLaw.veteranStatus !== "warVeteran") {
    record("labourLaw.veteranStatus", profile.labourLaw.veteranStatus, "warVeteran")
    profile.labourLaw.veteranStatus = "warVeteran"
  }
  if (cleanText(row[COL.martyr])?.startsWith("Bəli") && profile.labourLaw.isMartyrFamilyMember !== true) {
    record("labourLaw.isMartyrFamilyMember", profile.labourLaw.isMartyrFamilyMember, true)
    profile.labourLaw.isMartyrFamilyMember = true
  }

  // Leave. The Leave module derives the real entitlement from labour-law
  // data (base 21, +seniority from total experience, special-status bases),
  // so ƏMAS's base is carried through labourLaw.annualBaseLeaveDays, the field
  // that module reads for a non-statutory base. ƏMAS's own "staja görə"
  // figure is NOT copied — Nova's seniority comes from its own tiers.
  const leave = parseLeave(row[COL.leave])
  let leaveComparison: SyncResult["leaveComparison"]
  if (leave) {
    let resolved = resolveAnnualLeaveEntitlement(profile, now)
    const statusBase = resolved.components.some((c) => c.article === "Art. 119.1" || c.article === "Art. 119.2" || c.article === "Art. 120")
    // Statutory base without any contract override (21, or 30 for extended categories).
    const baseDays = resolveAnnualLeaveEntitlement(
      { ...profile, labourLaw: { ...profile.labourLaw, annualBaseLeaveDays: undefined } },
      now
    ).components
      .filter((c) => c.article === "Art. 114.2" || c.article === "Art. 114.3")
      .reduce((sum, c) => sum + c.days, 0)
    // Only ever raises the base (never lowers one HR set higher on purpose).
    if (!statusBase && leave.base > baseDays && (profile.labourLaw.annualBaseLeaveDays ?? 0) < leave.base) {
      record("labourLaw.annualBaseLeaveDays", profile.labourLaw.annualBaseLeaveDays, leave.base)
      profile.labourLaw.annualBaseLeaveDays = leave.base
      resolved = resolveAnnualLeaveEntitlement(profile, now)
    }
    const seniority = resolved.components.filter((c) => c.article === "Art. 116").reduce((sum, c) => sum + c.days, 0)
    const annual = resolved.totalDays - seniority
    if (annual !== profile.leave.annualLeaveEntitlement || seniority !== profile.leave.additionalLeaveEntitlement) {
      record(
        "leave.entitlement",
        `${profile.leave.annualLeaveEntitlement}+${profile.leave.additionalLeaveEntitlement}`,
        `${annual}+${seniority}`
      )
      profile.leave.annualLeaveEntitlement = annual
      profile.leave.additionalLeaveEntitlement = seniority
      // Placeholder summary only — the real balance is the leave ledger,
      // which this sync never touches.
      profile.leave.remainingLeaveDays = Math.max(0, resolved.totalDays - (profile.leave.usedLeaveDays ?? 0))
    }
    leaveComparison = { emasTotal: leave.base + leave.seniority, novaTotal: resolved.totalDays }
  }

  if (changes.length > 0) {
    const stamp = now.toISOString()
    const entries: AuditLogEntry[] = changes.map((change, i) => ({
      id: `AUD-${profile.employment.employeeNumber}-EMAS-${stamp}-${i + 1}`,
      timestamp: stamp,
      actor: EMAS_ACTOR,
      action: "emas.sync",
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
    }))
    profile.auditLog = [...(profile.auditLog ?? []), ...entries]
  }

  return { profile, changes, leaveComparison }
}

/**
 * Builds a brand-new profile from an ƏMAS row. ƏMAS has no company,
 * department, branch or manager, so those stay blank for HR to assign.
 * Returns undefined when the name can't be split or gender can't be derived.
 */
export function buildNewProfile(
  row: EmasRow,
  details: EmasDetailRow[],
  employeeNumber: string,
  now: Date = new Date()
): SyncResult | undefined {
  const finCode = cleanText(row[COL.fin])?.toUpperCase()
  const name = splitFullName(String(row[COL.fullName] ?? ""))
  if (!finCode || !name || !name.gender) return undefined

  const stamp = now.toISOString()
  const skeleton: EmployeeProfile = {
    id: employeeNumber,
    employmentStatus: "active",
    employment: {
      employeeNumber,
      hireDate: "",
      employmentType: "full-time",
      contractType: "permanent",
      department: "",
      position: "",
      grade: "",
      branch: "",
      company: "",
      workSchedule: "",
      workLocationType: "on-site",
      workLocation: "",
      history: [],
    },
    personal: {
      firstName: name.firstName,
      lastName: name.lastName,
      fatherName: name.fatherName,
      gender: name.gender,
      dateOfBirth: "",
      nationality: "Azərbaycanlı",
      maritalStatus: "single",
      finCode,
      nationalId: "",
      passportNumber: "",
      address: "",
      phone: "",
      email: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: "",
    },
    labourLaw: {
      isPregnant: false,
      isSingleParent: false,
      isAdoptiveParent: false,
      children: [],
      hasDisability: false,
      hazardousWork: false,
      undergroundWork: false,
      nightShiftWork: false,
      isShiftWork: false,
      previousWorkExperience: { years: 0, months: 0, days: 0 },
      hasCollectiveAgreementLeave: false,
      companyAdditionalLeaveDays: 0,
    },
    leave: {
      annualLeaveEntitlement: 21,
      additionalLeaveEntitlement: 0,
      usedLeaveDays: 0,
      remainingLeaveDays: 21,
      history: [],
    },
    payroll: { bankName: "", bankAccountNumber: "", baseSalary: 0, currency: "AZN", bonus: 0, allowances: [] },
    documents: [],
    education: { schools: [], universities: [], certificates: [], languages: [], skills: [] },
    assets: [],
    notes: [],
    auditLog: [],
    quickStats: { tenureYears: 0, directReports: 0, completedTrainings: 0, openTasks: 0 },
  }

  const { profile, changes, leaveComparison } = computeSync(skeleton, row, details, now)
  profile.employment.history = [
    {
      id: `EH-${employeeNumber}-1`,
      date: profile.employment.hireDate,
      type: "hire",
      title: `Hired as ${profile.employment.position}`,
      description: "Created from ƏMAS data.",
    },
  ]
  profile.auditLog = [{ id: `AUD-${employeeNumber}-1`, timestamp: stamp, actor: EMAS_ACTOR, action: "record.created" }]
  return { profile, changes, leaveComparison }
}
