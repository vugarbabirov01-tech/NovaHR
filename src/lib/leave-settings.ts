/**
 * Org-wide fallback constants for Leave Management — mirrors hr-settings.ts
 * exactly (same reasoning: nothing computes these values itself, every
 * future consumer reads them from here, and a future settings page can
 * replace DEFAULT_LEAVE_SETTINGS with a fetched/persisted value without any
 * consumer changing). Per-type/per-company overrides belong on LeavePolicy,
 * not here — these are only the values used when no LeavePolicy applies.
 */
export interface LeaveSettings {
  /** Month (1-12) the leave/fiscal year starts on. */
  fiscalYearStartMonth: number
  /** Default carry-forward expiry window, in months, when a LeavePolicy
   * doesn't specify its own carryForwardExpiryMonths. */
  defaultCarryForwardExpiryMonths: number
  /** Smallest unit a leave request can be rounded to, in days (e.g. 0.5 for
   * half-day granularity). */
  minimumRequestUnitDays: number
  /** Comma-separated weekday codes (MON..SUN) — the working-day pattern the
   * Leave Policy Resolution Engine falls back to when an employee's
   * EmployeeEmployment.workSchedule (free text) doesn't match any real
   * WorkSchedule row by label (a genuinely custom schedule, e.g. "Tue/Thu,
   * 10:00–15:00") and there's nothing more specific to resolve against. */
  defaultWorkingDays: string
}

export const DEFAULT_LEAVE_SETTINGS: LeaveSettings = {
  fiscalYearStartMonth: 1,
  defaultCarryForwardExpiryMonths: 3,
  minimumRequestUnitDays: 0.5,
  defaultWorkingDays: "MON,TUE,WED,THU,FRI",
}

export const LEAVE_SETTINGS: LeaveSettings = DEFAULT_LEAVE_SETTINGS
