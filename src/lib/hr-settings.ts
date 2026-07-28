/**
 * Single shared source of truth for the business-rule thresholds Smart
 * Filters (and any future consumer) are built on — nothing computes a
 * retirement age, a service-length threshold, or a warning window itself;
 * everything reads it from here. A future HR Settings page can replace
 * DEFAULT_HR_SETTINGS with a fetched/persisted value without any consumer
 * changing, since they only ever import HR_SETTINGS.
 */
export interface HrSettings {
  /** Age at which an employee is considered to have reached retirement. */
  retirementAge: number
  /** How many months ahead "retiring soon" looks. */
  retirementWithinMonths: number
  /** Years of service considered "long service". */
  longServiceThresholdYears: number
  /** Days ahead "probation ending soon" looks. */
  probationWarningDays: number
  /** Days back "recently hired" looks. */
  recentlyHiredDays: number
}

export const DEFAULT_HR_SETTINGS: HrSettings = {
  retirementAge: 65,
  retirementWithinMonths: 12,
  longServiceThresholdYears: 5,
  probationWarningDays: 14,
  recentlyHiredDays: 30,
}

export const HR_SETTINGS: HrSettings = DEFAULT_HR_SETTINGS
