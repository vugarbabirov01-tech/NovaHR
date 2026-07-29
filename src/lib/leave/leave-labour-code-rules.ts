/**
 * Every statutory leave-entitlement figure Nova HRMS relies on — the only
 * place these numbers are allowed to live (per the Leave Policy Resolution
 * Engine's own mandate: no other module may hardcode a Labour Code figure
 * independently). Sourced from the approved Azerbaijan Labour Code legal
 * research; each entry carries the Article it comes from and the research
 * document's own confidence rating (high/medium/low) — LOW and MEDIUM
 * confidence entries should be re-verified with AZ labour counsel before
 * this becomes the system of record for compensation-critical decisions.
 * Nothing here is a guess: where the research could not confirm a figure,
 * it is omitted rather than invented (see leave-policy-resolution-service.ts
 * for how each omission is handled).
 */
export const AZ_LABOUR_CODE_LEAVE_RULES = {
  /** Art. 114.2 — standard basic annual leave. Confidence: high. */
  BASE_ANNUAL_LEAVE_DAYS: 21,

  /** Art. 114.3 — extended basic leave for specific professions (exact
   * profession list not exhaustively verified; the day figure itself is
   * high confidence). Applied here only via professionalCategory values
   * this engine can actually detect (civilServant/judge/prosecutor/
   * medicalStaff/academicStaff) — see resolveAnnualLeaveEntitlement. */
  EXTENDED_BASE_ANNUAL_LEAVE_DAYS: 30,

  /** Art. 115 — hazardous/underground/high-tension work. Statutory
   * *minimum* only; specific hazard classifications may legally warrant
   * more, which this engine has no data to determine. Confidence: high
   * (for the minimum figure). */
  HAZARDOUS_WORK_MIN_DAYS: 6,

  /** Art. 116 — length-of-service additional leave. Service is cumulative
   * across employers (Constitutional Court, 29 Nov 2000), not scoped to
   * the current employer — see resolveAnnualLeaveEntitlement's use of
   * previousWorkExperience + calculateServiceDuration. Confidence: high. */
  SERVICE_LEAVE_TIERS: [
    { minYears: 5, maxYears: 10, days: 2 },
    { minYears: 10, maxYears: 15, days: 4 },
    { minYears: 15, maxYears: Number.POSITIVE_INFINITY, days: 6 },
  ],

  /** Art. 117 — women with children. Additive on top of whichever base
   * applies (not part of the non-stacking exclusion — see the service).
   * Confidence: high. */
  WOMEN_WITH_CHILDREN: {
    childAgeThresholdYears: 14,
    disabledChildAgeThresholdYears: 16,
    twoChildrenUnder14Days: 3,
    threeOrMoreUnder14OrDisabledChildDays: 6,
  },

  /** Art. 119.1 — employees under 18. Confidence: high. */
  MINOR_LEAVE_DAYS: {
    under16: 42,
    age16to18: 35,
  },

  /** Art. 119.2 — disabled employees, regardless of disability percentage,
   * cause, or duration. Confidence: high. */
  DISABLED_EMPLOYEE_LEAVE_DAYS: 42,

  /** Art. 120 — special service to the Azerbaijani people (war veterans,
   * combat participants, liberated-territories specialists, state
   * decoration holders — EmployeeLabourLaw.veteranStatus /
   * stateDecorationName). A 2026 amendment reportedly expanded this
   * category; the base figure is high confidence, the exact 2026 category
   * list is medium confidence. */
  SPECIAL_SERVICE_LEAVE_DAYS: 46,

  /** Art. 131 — first-year eligibility gate. Confidence: high — the most
   * consistently corroborated rule in the research. */
  FIRST_YEAR_ELIGIBILITY_MONTHS: 6,

  /** Art. 114.6 — a public holiday (or national mourning day — modeled
   * identically, see Holiday) inside a leave period is not counted toward
   * the requested days and is not paid, so the period's calendar span
   * extends by one day per holiday encountered. Weekends do not trigger
   * the same extension — they're already inside the calendar-day count.
   * Confidence: high. */
  HOLIDAY_EXTENDS_LEAVE: true,
} as const

/**
 * Not implemented — documented gap, not a guess. Art. 118 (coaches and
 * teachers, 42 days) requires distinguishing "teacher/coach" from other
 * academic staff, and EmployeeLabourLaw.professionalCategory has no such
 * value (only civilServant/judge/prosecutor/academicStaff/medicalStaff).
 * Per "do not redesign" scope for this phase, academicStaff instead falls
 * through to EXTENDED_BASE_ANNUAL_LEAVE_DAYS (Art. 114.3, 30 days) in
 * resolveAnnualLeaveEntitlement, which understates the true Art. 118
 * entitlement for actual teachers/coaches. Flagged in the resolution
 * result's components (source: "gap"), not silently absorbed.
 */
export const TEACHER_COACH_LEAVE_GAP_NOTE =
  "Art. 118 (teachers/coaches, 42 days) cannot be reliably detected — no data field distinguishes this from other academic staff. Falls through to the Art. 114.3 extended-base (30 days) instead of guessing."
