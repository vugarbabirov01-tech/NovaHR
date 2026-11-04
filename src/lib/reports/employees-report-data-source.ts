import { calculateAgeFromDateOfBirth, calculateServiceDuration } from "@/lib/employees"
import { findAllEmployees } from "@/repositories/employee-repository"
import type { EmployeeProfile } from "@/types/employee-profile"
import type { ReportRow } from "@/types/reports"

/**
 * Flattens one EmployeeProfile into the flat row shape the field registry
 * describes — the Report Builder's equivalent of profileToExportRow, but
 * reading only the fields EMPLOYEE_REPORT_FIELDS declares (see that file's
 * own comment for what's deliberately excluded and why). Raw enum values
 * are kept as-is here (e.g. "full-time", not a translated label) — the UI
 * layer translates them at render/export time via each field's
 * enumNamespace/enumKeyMap, so the same row works for every locale without
 * re-flattening.
 */
function flattenEmployee(profile: EmployeeProfile): ReportRow {
  return {
    firstName: profile.personal.firstName ?? "",
    lastName: profile.personal.lastName ?? "",
    fatherName: profile.personal.fatherName ?? "",
    gender: profile.personal.gender ?? "",
    dateOfBirth: profile.personal.dateOfBirth ?? "",
    age: profile.personal.dateOfBirth ? calculateAgeFromDateOfBirth(profile.personal.dateOfBirth) : null,
    nationality: profile.personal.nationality ?? "",
    maritalStatus: profile.personal.maritalStatus ?? "",
    phone: profile.personal.phone ?? "",
    email: profile.personal.email ?? "",

    employeeNumber: profile.employment.employeeNumber ?? "",
    hireDate: profile.employment.hireDate ?? "",
    tenureYears: profile.employment.hireDate ? calculateServiceDuration(profile.employment.hireDate).years : null,
    probationEndDate: profile.employment.probationEndDate ?? "",
    employmentType: profile.employment.employmentType ?? "",
    contractType: profile.employment.contractType ?? "",
    employmentStatus: profile.employmentStatus ?? "",
    company: profile.employment.company ?? "",
    branch: profile.employment.branch ?? "",
    department: profile.employment.department ?? "",
    position: profile.employment.position ?? "",
    grade: profile.employment.grade ?? "",
    managerName: profile.employment.managerName ?? "",
    workSchedule: profile.employment.workSchedule ?? "",
    workLocationType: profile.employment.workLocationType ?? "",
    workLocation: profile.employment.workLocation ?? "",
  }
}

/** Always reads the live, real Employee table — never cached, never mocked. */
export async function fetchEmployeeReportRows(): Promise<ReportRow[]> {
  const profiles = await findAllEmployees()
  return profiles.map(flattenEmployee)
}
