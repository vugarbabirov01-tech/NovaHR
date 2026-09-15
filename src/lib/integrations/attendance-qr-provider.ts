import type {
  AttendanceProvider,
  AttendanceStatus,
  AttendanceTenantKey,
  AttendanceTenantSummary,
  AttendanceTodayRow,
} from "@/types/integrations/attendance"

// A real HTTP integration — unlike every other file in this directory
// (payroll/leave/asset/document), which mocks a system that doesn't exist
// yet, AttendanceQR is already live in production. This still exports the
// same `xProvider: XProvider = new XImpl()` shape those files use, so a
// caller can't tell the difference — only this file knows it's making a
// real network call.

const REQUEST_TIMEOUT_MS = 8000

interface TenantConfig {
  tenantKey: AttendanceTenantKey
  companyLabel: string
  baseUrl?: string
  email?: string
  password?: string
}

// One base URL/login per tenant — AttendanceQR resolves the company from
// the authenticated JWT (see its own TenantContext), so two separate admin
// logins are what "both companies" actually requires, not one shared
// credential. baseUrl is per tenant too since it may be a distinct
// subdomain (e.g. https://baki.qrlog.az vs https://cleanfix.qrlog.az) —
// this provider never assumes which.
function readTenantConfig(tenantKey: AttendanceTenantKey, companyLabel: string, envPrefix: string): TenantConfig {
  return {
    tenantKey,
    companyLabel,
    baseUrl: process.env[`${envPrefix}_BASE_URL`]?.replace(/\/+$/, ""),
    email: process.env[`${envPrefix}_EMAIL`],
    password: process.env[`${envPrefix}_PASSWORD`],
  }
}

const TENANTS: TenantConfig[] = [
  readTenantConfig("baki", "Bakı Abadlıq Xidməti", "ATTENDANCE_QR_BAKI"),
  readTenantConfig("cleanfix", "CleanFix", "ATTENDANCE_QR_CLEANFIX"),
]

function emptySummary(
  config: TenantConfig,
  errorReason: NonNullable<AttendanceTenantSummary["errorReason"]>
): AttendanceTenantSummary {
  return {
    tenantKey: config.tenantKey,
    companyLabel: config.companyLabel,
    available: false,
    errorReason,
    totalCheckIns: 0,
    totalCheckOuts: 0,
    lateCount: 0,
    absentCount: 0,
    stillAtWorkCount: 0,
    rows: [],
  }
}

// AttendanceQR's own DayAttendanceRow, camelCase over the wire (the API
// serializes enums as JsonStringEnumConverter strings, everything else
// System.Text.Json's default camelCase policy) — only the fields Nova
// actually displays are declared; the other ~30 (face-match, device
// binding, field-visit GPS, split-shift blocks, ...) are ignored, not
// modeled.
interface RawTodayRow {
  employeeId: string
  employeeName: string
  locationName: string
  position: string | null
  status: string
  checkInAtUtc: string | null
  checkOutAtUtc: string | null
}

async function login(config: TenantConfig): Promise<string | null> {
  const response = await fetch(`${config.baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: config.email, password: config.password }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!response.ok) return null
  const body = (await response.json()) as { token?: string }
  return body.token ?? null
}

async function fetchTodayRows(config: TenantConfig, token: string): Promise<RawTodayRow[]> {
  const response = await fetch(`${config.baseUrl}/api/reports/today`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`AttendanceQR /reports/today: ${response.status}`)
  return (await response.json()) as RawTodayRow[]
}

// These are the exact strings AttendanceQR's live board emits for TODAY
// (ReportQueryService.BoardDisplayStatus + its "today"-only relabeling) —
// passed through as AttendanceStatus rather than re-derived, and only
// asserted, never validated against a wider set, since an unrecognized
// value here would mean AttendanceQR added a new status this file hasn't
// been told about yet.
const KNOWN_STATUSES: ReadonlySet<string> = new Set<AttendanceStatus>([
  "OnTime",
  "Late",
  "Absent",
  "Incomplete",
  "DayOff",
  "OnLeave",
  "Permission",
  "Pending",
  "Field",
  "Onboarding",
])

function toAttendanceStatus(status: string): AttendanceStatus {
  return (KNOWN_STATUSES.has(status) ? status : "Pending") as AttendanceStatus
}

function summarize(config: TenantConfig, rawRows: RawTodayRow[]): AttendanceTenantSummary {
  const rows: AttendanceTodayRow[] = rawRows.map((row) => ({
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    locationName: row.locationName,
    position: row.position,
    status: toAttendanceStatus(row.status),
    checkInAt: row.checkInAtUtc,
    checkOutAt: row.checkOutAtUtc,
  }))

  return {
    tenantKey: config.tenantKey,
    companyLabel: config.companyLabel,
    available: true,
    totalCheckIns: rows.filter((row) => row.checkInAt !== null).length,
    totalCheckOuts: rows.filter((row) => row.checkOutAt !== null).length,
    lateCount: rows.filter((row) => row.status === "Late").length,
    absentCount: rows.filter((row) => row.status === "Absent").length,
    // Always today's board (no ?date= passed) — "Incomplete" here can only
    // mean "checked in, not out yet", i.e. still at work, never a past
    // day's forgotten check-out.
    stillAtWorkCount: rows.filter((row) => row.status === "Incomplete").length,
    rows,
  }
}

async function fetchTenantSummary(config: TenantConfig): Promise<AttendanceTenantSummary> {
  if (!config.baseUrl || !config.email || !config.password) {
    return emptySummary(config, "not-configured")
  }

  try {
    const token = await login(config)
    if (!token) return emptySummary(config, "login-failed")

    const rawRows = await fetchTodayRows(config, token)
    return summarize(config, rawRows)
  } catch {
    // Network failure, timeout, or an unexpected response shape — this
    // tenant's card shows "couldn't connect", the other tenant is
    // unaffected (see AttendanceQrProvider.getTodaySummaries).
    return emptySummary(config, "unreachable")
  }
}

class AttendanceQrProvider implements AttendanceProvider {
  async getTodaySummaries(): Promise<AttendanceTenantSummary[]> {
    return Promise.all(TENANTS.map(fetchTenantSummary))
  }
}

export const attendanceProvider: AttendanceProvider = new AttendanceQrProvider()
