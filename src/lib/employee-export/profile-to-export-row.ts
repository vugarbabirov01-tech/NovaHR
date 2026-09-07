import {
  addDurations,
  calculateAgeFromDateOfBirth,
  calculateServiceDuration,
} from "@/lib/employees"
import type { EmployeeProfile } from "@/types/employee-profile"
import type { ImportableField } from "@/lib/employee-import/types"
import type { ExportType } from "@/lib/employee-export/types"
import {
  CONTRACT_TYPE_VALUE_LABELS,
  EMPLOYMENT_TYPE_VALUE_LABELS,
  GENDER_VALUE_LABELS,
  MARITAL_STATUS_VALUE_LABELS,
  WORK_LOCATION_TYPE_VALUE_LABELS,
} from "@/lib/employee-import/column-mapping"
import {
  DISABILITY_GROUP_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  PROFESSIONAL_CATEGORY_LABELS,
  VETERAN_STATUS_LABELS,
  type ReportOnlyField,
} from "@/lib/employee-export/report-only-fields"

export type ExportRow = Record<ImportableField, string> & Partial<Record<ReportOnlyField, string>>

function formatWorkDuration(duration: { years: number; months: number; days: number }): string {
  return `${duration.years} il ${duration.months} ay ${duration.days} gün`
}

/**
 * The inverse of Import's row-mapper — and considerably simpler, since
 * EmployeeProfile.employment already stores department/position/company/
 * manager/workSchedule as plain display names, not ids. No master-data
 * lookup is needed on the way out, only on the way in.
 *
 * Only ever reads personal/employment (+ a few labourLaw/payroll fields for
 * the Full Report) — documents, education, assets, notes, auditLog,
 * quickStats, leave, employment.history/grade and id are never touched, by
 * construction.
 */
export function profileToExportRow(profile: EmployeeProfile, exportType: ExportType): ExportRow {
  const row: ExportRow = {
    firstName: profile.personal.firstName ?? "",
    lastName: profile.personal.lastName ?? "",
    fatherName: profile.personal.fatherName ?? "",
    gender: GENDER_VALUE_LABELS[profile.personal.gender] ?? "",
    dateOfBirth: profile.personal.dateOfBirth ?? "",
    nationality: profile.personal.nationality ?? "",
    maritalStatus: MARITAL_STATUS_VALUE_LABELS[profile.personal.maritalStatus] ?? "",
    finCode: profile.personal.finCode ?? "",
    nationalId: profile.personal.nationalId ?? "",
    passportNumber: profile.personal.passportNumber ?? "",
    address: profile.personal.address ?? "",
    phone: profile.personal.phone ?? "",
    email: profile.personal.email ?? "",
    emergencyContactName: profile.personal.emergencyContactName ?? "",
    emergencyContactPhone: profile.personal.emergencyContactPhone ?? "",
    emergencyContactRelation: profile.personal.emergencyContactRelation ?? "",
    employeeNumber: profile.employment.employeeNumber ?? "",
    hireDate: profile.employment.hireDate ?? "",
    probationEndDate: profile.employment.probationEndDate ?? "",
    employmentType: EMPLOYMENT_TYPE_VALUE_LABELS[profile.employment.employmentType] ?? "",
    contractType: CONTRACT_TYPE_VALUE_LABELS[profile.employment.contractType] ?? "",
    department: profile.employment.department ?? "",
    position: profile.employment.position ?? "",
    company: profile.employment.company ?? "",
    manager: profile.employment.managerName ?? "",
    workSchedule: profile.employment.workSchedule ?? "",
    workLocationType: WORK_LOCATION_TYPE_VALUE_LABELS[profile.employment.workLocationType] ?? "",
    workLocation: profile.employment.workLocation ?? "",
    salary: profile.payroll.baseSalary ? String(profile.payroll.baseSalary) : "",
    salaryStartDate: profile.payroll.salaryEffectiveDate ?? "",
  }

  if (exportType === "fullReport") {
    row.employmentStatus = EMPLOYMENT_STATUS_LABELS[profile.employmentStatus] ?? ""
    row.grade = profile.employment.grade ?? ""
    row.age = profile.personal.dateOfBirth
      ? String(calculateAgeFromDateOfBirth(profile.personal.dateOfBirth))
      : ""
    row.totalWorkExperience = profile.employment.hireDate
      ? formatWorkDuration(
          addDurations(profile.labourLaw.previousWorkExperience, calculateServiceDuration(profile.employment.hireDate))
        )
      : ""
    row.professionalCategory = profile.labourLaw.professionalCategory
      ? (PROFESSIONAL_CATEGORY_LABELS[profile.labourLaw.professionalCategory] ?? "")
      : ""
    row.veteranStatus = profile.labourLaw.veteranStatus
      ? (VETERAN_STATUS_LABELS[profile.labourLaw.veteranStatus] ?? "")
      : ""
    row.hasDisability = profile.labourLaw.hasDisability ? "Bəli" : ""
    row.disabilityGroup = profile.labourLaw.disabilityGroup
      ? (DISABILITY_GROUP_LABELS[profile.labourLaw.disabilityGroup] ?? "")
      : ""
    row.baseSalary = profile.payroll.baseSalary ? String(profile.payroll.baseSalary) : ""
    row.currency = profile.payroll.currency ?? ""
  }

  return row
}
