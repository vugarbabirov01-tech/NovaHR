import { ALL_PERMISSION_KEYS, type PermissionKey } from "@/lib/auth/permissions"

export type RoleKey =
  | "SUPER_ADMIN"
  | "HR_ADMIN"
  | "HR_SPECIALIST"
  | "COMPANY_MANAGER"
  | "BRANCH_MANAGER"
  | "PAYROLL_SPECIALIST"
  | "AUDITOR"

export interface RoleDefinition {
  key: RoleKey
  name: string
  description: string
}

export const ROLE_DEFINITIONS: Record<RoleKey, RoleDefinition> = {
  SUPER_ADMIN: { key: "SUPER_ADMIN", name: "Super Admin", description: "Full system access, user/role management. Always GLOBAL scope — enforced in the service layer." },
  HR_ADMIN: { key: "HR_ADMIN", name: "HR Admin", description: "Full HR operational control — employee lifecycle, organization, leave. Not system/user administration." },
  HR_SPECIALIST: { key: "HR_SPECIALIST", name: "HR Specialist", description: "Day-to-day HR operations within scope — no delete rights, no payroll." },
  COMPANY_MANAGER: { key: "COMPANY_MANAGER", name: "Company Manager", description: "Read-mostly oversight of one company." },
  BRANCH_MANAGER: { key: "BRANCH_MANAGER", name: "Branch Manager", description: "Read-mostly oversight of one or more branches." },
  PAYROLL_SPECIALIST: { key: "PAYROLL_SPECIALIST", name: "Finance / Payroll Specialist", description: "Payroll data and payroll-sourced reports only." },
  AUDITOR: { key: "AUDITOR", name: "Auditor", description: "Read-only across every module, plus the audit log itself." },
}

/**
 * The permission set per role — seeded by prisma/seed-auth.ts, editable
 * later without a code change once Phase E's admin UI exists. Six items
 * below were explicitly reviewed and DECIDED on 2026-11-05 (each marked
 * "DECIDED 2026-11-05" at its omission, confirming the withheld default
 * this file already proposed — nothing was actually widened or narrowed
 * by that review). Every remaining omission that could still reasonably
 * go either way stays marked CONTESTED — per the instruction not to
 * auto-grant a contested permission, the default for anything still
 * genuinely open is to leave it OUT and flag it, never guess broad and
 * narrow later.
 *
 * None of SELF_DERIVED_PERMISSION_KEYS (EMPLOYEE_SELF_VIEW,
 * PAYROLL_SELF_VIEW) appear in any ordinary role below — enforced by
 * role-permission-matrix.test.ts, not just this comment.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  // Every permission, including SELF_DERIVED ones — Super Admin bypasses
  // the normal self/role distinction entirely by design.
  SUPER_ADMIN: [...ALL_PERMISSION_KEYS],

  HR_ADMIN: [
    "EMPLOYEES_VIEW",
    "EMPLOYEES_CREATE",
    "EMPLOYEES_EDIT",
    "EMPLOYEES_DELETE",
    "ORGANIZATION_VIEW",
    "ORGANIZATION_EDIT",
    "LEAVE_VIEW",
    "LEAVE_CREATE",
    "LEAVE_CANCEL",
    "ATTENDANCE_VIEW",
    "PAYROLL_VIEW_PERIODS", // DECIDED 2026-11-05: NOT PAYROLL_VIEW_AMOUNTS — salary figures stay with PAYROLL_SPECIALIST/SUPER_ADMIN only.
    "REPORTS_CREATE",
    "REPORTS_VIEW",
    "REPORTS_EDIT",
    "REPORTS_DELETE",
    "REPORTS_EXPORT",
    // DECIDED 2026-11-05: NOT SETTINGS_MANAGE_USERS, NOT AUDIT_LOG_VIEW —
    // user/role administration and audit visibility stay a SUPER_ADMIN/
    // AUDITOR concern, not an HR operational one.
  ],

  HR_SPECIALIST: [
    "EMPLOYEES_VIEW",
    "EMPLOYEES_CREATE", // CONTESTED: day-to-day onboarding is typically a specialist task; withhold if this should be HR_ADMIN-only instead.
    "EMPLOYEES_EDIT",
    // CONTESTED: EMPLOYEES_DELETE withheld — deletion is treated as a rarer, higher-stakes HR_ADMIN action by default.
    "LEAVE_VIEW",
    "LEAVE_CREATE",
    "LEAVE_CANCEL",
    "ATTENDANCE_VIEW",
    "REPORTS_CREATE",
    "REPORTS_VIEW",
    "REPORTS_EDIT",
    "REPORTS_EXPORT",
    // CONTESTED: REPORTS_DELETE withheld — deleting a report (possibly someone else's) is treated as an HR_ADMIN-level action by default.
  ],

  // Deliberately read-mostly — a Manager role is oversight, not an HR
  // operator, by default. CONTESTED: should a Manager be able to
  // create/approve leave for their own reports? Withheld for now; add
  // LEAVE_CREATE/LEAVE_CANCEL explicitly if that's the intended workflow.
  COMPANY_MANAGER: ["EMPLOYEES_VIEW", "ORGANIZATION_VIEW", "LEAVE_VIEW", "ATTENDANCE_VIEW", "REPORTS_VIEW"],
  BRANCH_MANAGER: ["EMPLOYEES_VIEW", "ORGANIZATION_VIEW", "LEAVE_VIEW", "ATTENDANCE_VIEW", "REPORTS_VIEW"],

  PAYROLL_SPECIALIST: [
    "PAYROLL_VIEW_PERIODS",
    "PAYROLL_VIEW_AMOUNTS",
    "PAYROLL_EDIT",
    "REPORTS_CREATE",
    "REPORTS_VIEW",
    "REPORTS_EXPORT",
    // DECIDED 2026-11-05: NOT the full EMPLOYEES_VIEW — data minimization
    // wins over convenience for a payroll-only role. EMPLOYEES_VIEW_BASIC
    // (identification-only: name/department/company, registered in
    // permissions.ts) is reserved for exactly this role's future need to
    // resolve a payroll record's employeeId to a person — not yet granted
    // here either; add it explicitly once that's wanted, rather than
    // folding it into this seed silently.
  ],

  AUDITOR: [
    "EMPLOYEES_VIEW",
    "ORGANIZATION_VIEW",
    "LEAVE_VIEW",
    "ATTENDANCE_VIEW",
    "PAYROLL_VIEW_PERIODS",
    "REPORTS_VIEW",
    "AUDIT_LOG_VIEW",
    // DECIDED 2026-11-05: NOT PAYROLL_VIEW_AMOUNTS, NOT REPORTS_EXPORT —
    // seeing every salary and letting data leave the system via export
    // both stay outside the Auditor's default read-only mandate.
    // No *_EDIT/*_CREATE/*_DELETE anywhere — strictly read-only, by design.
  ],
}
