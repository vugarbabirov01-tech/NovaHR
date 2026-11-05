// Centralized, type-safe permission registry — Authentication Phase A.
// Nothing in this file is read by any Server Action/Component yet (that's
// Phase C+); this is the single source of truth every future
// requirePermission() call and the seed script will both read from, so a
// permission key can never exist in one place and not the other.

export type PermissionModule =
  | "EMPLOYEES"
  | "ORGANIZATION"
  | "LEAVE"
  | "ATTENDANCE"
  | "PAYROLL"
  | "REPORTS"
  | "SETTINGS"
  | "AUDIT"

export type PermissionAction = "VIEW" | "CREATE" | "EDIT" | "DELETE" | "EXPORT" | "CANCEL" | "MANAGE"

/** "self" and "sensitive" are not scope types (GLOBAL/COMPANY/BRANCH) — they
 * describe what KIND of data the permission gates, independent of scope:
 *  - "normal": gated only by scope (company/branch), nothing more.
 *  - "sensitive": still scope-gated, but additionally represents data this
 *    codebase has deliberately excluded from the Report Builder's field
 *    registries until now (payroll amounts, labour-law fields, legal IDs) —
 *    granting it is a separate, more deliberate decision than granting the
 *    module's ordinary VIEW.
 *  - "self": identity-derived, never granted through UserRoleAssignment —
 *    see EMPLOYEE_SELF_VIEW/PAYROLL_SELF_VIEW's own entries below.
 */
export type PermissionDataLevel = "normal" | "sensitive" | "self"

export interface PermissionDefinition {
  key: string
  module: PermissionModule
  action: PermissionAction
  dataLevel: PermissionDataLevel
  description: string
}

/**
 * EMPLOYEE_SELF_VIEW and PAYROLL_SELF_VIEW are deliberately never assigned
 * through UserRoleAssignment (no Role includes them in
 * role-permission-matrix.ts) — they exist here purely so every permission
 * check and every audit-log entry can cite one consistent key, even for an
 * identity-derived permission. The actual grant is: EMPLOYEE_SELF_VIEW
 * whenever User.employeeId is non-null (personal + employment-activity
 * fields only, never payroll/labour-law); PAYROLL_SELF_VIEW is a SEPARATE,
 * stricter check — having a linked employeeId is necessary but not
 * sufficient, since seeing one's own salary is a more deliberate policy
 * decision than seeing one's own name/department. Both checks are
 * service-layer logic (Phase C+), not expressed as rows anyone can revoke
 * via UserRoleAssignment.
 */
export const PERMISSIONS: Record<string, PermissionDefinition> = {
  EMPLOYEES_VIEW: {
    key: "EMPLOYEES_VIEW",
    module: "EMPLOYEES",
    action: "VIEW",
    dataLevel: "normal",
    description: "View employee profiles within scope (personal + employment fields, never payroll/labour-law).",
  },
  EMPLOYEES_CREATE: { key: "EMPLOYEES_CREATE", module: "EMPLOYEES", action: "CREATE", dataLevel: "normal", description: "Create a new employee record." },
  EMPLOYEES_VIEW_BASIC: {
    key: "EMPLOYEES_VIEW_BASIC",
    module: "EMPLOYEES",
    action: "VIEW",
    dataLevel: "normal",
    description:
      "Identification-only lookup (name, department, company) — never the full profile EMPLOYEES_VIEW grants. " +
      "Registered for PAYROLL_SPECIALIST's future need to resolve a payroll record's employeeId to a person, " +
      "per the 2026-11-05 decision to withhold full EMPLOYEES_VIEW from that role. Not granted to any role yet — " +
      "see role-permission-matrix.ts's own comment on PAYROLL_SPECIALIST.",
  },
  EMPLOYEES_EDIT: { key: "EMPLOYEES_EDIT", module: "EMPLOYEES", action: "EDIT", dataLevel: "normal", description: "Edit an existing employee record within scope." },
  EMPLOYEES_DELETE: { key: "EMPLOYEES_DELETE", module: "EMPLOYEES", action: "DELETE", dataLevel: "normal", description: "Permanently remove an employee record." },
  EMPLOYEE_SELF_VIEW: {
    key: "EMPLOYEE_SELF_VIEW",
    module: "EMPLOYEES",
    action: "VIEW",
    dataLevel: "self",
    description: "View one's own personal + employment-activity fields. Identity-derived — never assigned via UserRoleAssignment.",
  },
  PAYROLL_SELF_VIEW: {
    key: "PAYROLL_SELF_VIEW",
    module: "PAYROLL",
    action: "VIEW",
    dataLevel: "self",
    description: "View one's own salary/payroll figures. Separate from EMPLOYEE_SELF_VIEW by design — identity-derived, never assigned via UserRoleAssignment.",
  },

  ORGANIZATION_VIEW: { key: "ORGANIZATION_VIEW", module: "ORGANIZATION", action: "VIEW", dataLevel: "normal", description: "View the org chart / company-branch-department-position catalog within scope." },
  ORGANIZATION_EDIT: { key: "ORGANIZATION_EDIT", module: "ORGANIZATION", action: "EDIT", dataLevel: "normal", description: "Edit org structure (manager reassignment, top-executive designation, ...)." },

  LEAVE_VIEW: { key: "LEAVE_VIEW", module: "LEAVE", action: "VIEW", dataLevel: "normal", description: "View leave requests/balances within scope." },
  LEAVE_CREATE: { key: "LEAVE_CREATE", module: "LEAVE", action: "CREATE", dataLevel: "normal", description: "Create (auto-approved) leave on behalf of an employee within scope." },
  LEAVE_CANCEL: { key: "LEAVE_CANCEL", module: "LEAVE", action: "CANCEL", dataLevel: "normal", description: "Cancel an existing leave request within scope." },

  ATTENDANCE_VIEW: { key: "ATTENDANCE_VIEW", module: "ATTENDANCE", action: "VIEW", dataLevel: "normal", description: "View today's attendance board within scope." },

  PAYROLL_VIEW_PERIODS: { key: "PAYROLL_VIEW_PERIODS", module: "PAYROLL", action: "VIEW", dataLevel: "normal", description: "View payroll period/status/employee-context — never a monetary figure." },
  PAYROLL_VIEW_AMOUNTS: { key: "PAYROLL_VIEW_AMOUNTS", module: "PAYROLL", action: "VIEW", dataLevel: "sensitive", description: "View base salary/additions/deductions/gross/net figures within scope." },
  PAYROLL_EDIT: { key: "PAYROLL_EDIT", module: "PAYROLL", action: "EDIT", dataLevel: "sensitive", description: "Create/modify payroll periods and records." },

  REPORTS_CREATE: { key: "REPORTS_CREATE", module: "REPORTS", action: "CREATE", dataLevel: "normal", description: "Create a new report definition." },
  REPORTS_VIEW: { key: "REPORTS_VIEW", module: "REPORTS", action: "VIEW", dataLevel: "normal", description: "Open/preview an existing saved report." },
  REPORTS_EDIT: { key: "REPORTS_EDIT", module: "REPORTS", action: "EDIT", dataLevel: "normal", description: "Modify an existing saved report." },
  REPORTS_DELETE: { key: "REPORTS_DELETE", module: "REPORTS", action: "DELETE", dataLevel: "normal", description: "Delete a saved report." },
  REPORTS_EXPORT: { key: "REPORTS_EXPORT", module: "REPORTS", action: "EXPORT", dataLevel: "normal", description: "Export a report to Excel — every export is audit-logged regardless of role." },

  SETTINGS_MANAGE_USERS: { key: "SETTINGS_MANAGE_USERS", module: "SETTINGS", action: "MANAGE", dataLevel: "sensitive", description: "Create/deactivate users, assign/revoke roles and scopes (the future /settings/users screen)." },
  AUDIT_LOG_VIEW: { key: "AUDIT_LOG_VIEW", module: "AUDIT", action: "VIEW", dataLevel: "sensitive", description: "View the authentication/authorization audit log." },
}

export type PermissionKey = keyof typeof PERMISSIONS

export const ALL_PERMISSION_KEYS: PermissionKey[] = Object.keys(PERMISSIONS) as PermissionKey[]

/** Permissions that are identity-derived and must NEVER appear in any
 * Role's permission set in role-permission-matrix.ts — a structural
 * guardrail, enforced by a test, not just a comment. */
export const SELF_DERIVED_PERMISSION_KEYS: PermissionKey[] = ALL_PERMISSION_KEYS.filter(
  (key) => PERMISSIONS[key].dataLevel === "self"
)
