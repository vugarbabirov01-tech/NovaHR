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
  // Computed once and reused for all three tenure fields below — tenureYears
  // (whole years, unchanged, backward-compatible with existing saved
  // reports), tenureYearsDecimal (sub-year precision for filters/KPIs), and
  // tenureDurationMonths (rendered as "X il Y ay" at display time via that
  // field's own durationUnit flag — see field-registry.ts).
  const tenure = profile.employment.hireDate ? calculateServiceDuration(profile.employment.hireDate) : null

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
    tenureYears: tenure ? tenure.years : null,
    tenureYearsDecimal: tenure ? Math.round((tenure.years + tenure.months / 12 + tenure.days / 365) * 100) / 100 : null,
    tenureDurationMonths: tenure ? tenure.years * 12 + tenure.months : null,
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
    grossSalary: profile.payroll.grossSalary ?? null,
  }
}

/** Always reads the live, real Employee table — never cached, never mocked. */
export async function fetchEmployeeReportRows(): Promise<ReportRow[]> {
  const profiles = await findAllEmployees()
  return profiles.map(flattenEmployee)
}
