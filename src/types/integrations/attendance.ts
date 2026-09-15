// The Dashboard/Davamiyyət page's own view of AttendanceQR's "today" board —
// deliberately a small slice of AttendanceQR's real DayAttendanceRow (which
// carries ~35 fields: face-match scores, device binding, field-visit GPS,
// split-shift blocks, ...). Nova only ever displays who's in/out today, so
// only those fields are modeled here; nothing else is fetched or stored.

export type AttendanceTenantKey = "baki" | "cleanfix"

/**
 * AttendanceQR's own live-board status string for today (see
 * ReportQueryService.BoardDisplayStatus in the AttendanceQR repo) — passed
 * through as-is, never re-derived here, so Nova's label can never disagree
 * with what AttendanceQR itself shows for the same employee today.
 */
export type AttendanceStatus =
  | "OnTime"
  | "Late"
  | "Absent"
  | "Incomplete" // always "still at work" here — this provider only ever asks for TODAY's board
  | "DayOff"
  | "OnLeave"
  | "Permission"
  | "Pending" // shift hasn't started yet — not a real absence
  | "Field"
  | "Onboarding" // imported, no first scan yet — not a real absence

export interface AttendanceTodayRow {
  employeeId: string
  employeeName: string
  locationName: string
  position: string | null
  status: AttendanceStatus
  checkInAt: string | null
  checkOutAt: string | null
}

/**
 * One tenant's (company's) whole "today" picture. `available: false` means
 * either this tenant isn't configured yet (no env vars set) or its API
 * couldn't be reached — never a reason to fabricate zeros as if they were
 * real counts. The four counts below are derived from `rows` by the
 * provider (see AttendanceQrProvider) rather than fetched from a separate
 * dashboard endpoint — one API call per tenant, not two.
 */
export interface AttendanceTenantSummary {
  tenantKey: AttendanceTenantKey
  companyLabel: string
  available: boolean
  errorReason?: "not-configured" | "login-failed" | "unreachable"
  totalCheckIns: number
  totalCheckOuts: number
  lateCount: number
  absentCount: number
  stillAtWorkCount: number
  rows: AttendanceTodayRow[]
}

export interface AttendanceProvider {
  /** One summary per configured tenant, Bakı Abadlıq Xidməti + CleanFix —
   * always resolves (never throws), so one tenant's outage never blocks the
   * other's real data from rendering. */
  getTodaySummaries(): Promise<AttendanceTenantSummary[]>
}
