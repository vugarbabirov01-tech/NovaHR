// Applies one employee's row of the checked HR list (and their ƏMAS periods) to
// a Nova profile. Pure: no I/O, never mutates its input.
//
//  - ƏMAS previous experience becomes the official figure.
//  - HR's "Ümumi iş stajı" (experience before joining) becomes a *pending*
//    work-book entry only when it is larger; it counts for leave once HR
//    confirms it. A smaller figure is treated as a mistake and ignored.
//  - "Faktiki staj" is stored as company information.
//  - A decision HR has already made in Nova is never overwritten.

import { cleanText, parseDisability, type EmasCell } from "@/lib/emas-sync/parse"
import { durationToDays, isValidIsoDate, resolveExperience, sameDuration } from "@/lib/experience/work-experience"
import { resolveAnnualLeaveEntitlement } from "@/lib/leave/leave-policy-resolution-service"
import type {
  AuditLogEntry,
  EmployeeProfile,
  PreviousEmployment,
  WorkBookExperience,
  WorkExperienceDuration,
} from "@/types/employee-profile"

export type SheetRow = Record<string, EmasCell>

export const HR_COL = {
  fin: "FİN",
  hireDate: "İşə qəbul tarixi",
  actualStart: "Faktiki staj",
  declaredTotal: "Ümumi iş stajı",
  official: "Ümumi əvvəlki staj",
  disability: "Əlillik dərəcəsi (ƏMAS)",
  veteran: "Müharibə veteranı statusu",
} as const

export const PERIOD_COL = {
  fin: "FİN",
  organization: "Qurum",
  taxId: "VÖEN",
  position: "Vəzifə",
  start: "Başlama tarixi",
  end: "Xitam tarixi",
  counted: "Hesaba alınıb?",
  countedPeriod: "Hesaba alınan dövr",
  note: "Səbəb / qeyd",
} as const

export const OWN_COMPANY_TAX_ID = "1301709881"
export const HR_IMPORT_ACTOR = "HR siyahısının idxalı"
export const HR_IMPORT_NOTE = "HR siyahısı (noyabr 2026)"
/** The date the list's experience figures were checked against ƏMAS. */
export const HR_IMPORT_DATE = "2026-11-24"
/** Differences of a few days are rounding, not extra experience. */
const TOLERANCE_DAYS = 3

/** Excel serial, "dd.mm.yyyy" or ISO text -> ISO date. */
export function parseSheetDate(value: EmasCell): string | undefined {
  if (typeof value === "number") {
    if (value <= 3000) return undefined
    return new Date(Math.round((value - 25569) * 86_400_000)).toISOString().slice(0, 10)
  }
  const text = cleanText(value)
  if (!text) return undefined
  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text)
  const iso = dotted ? `${dotted[3]}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}` : text
  return isValidIsoDate(iso) ? iso : undefined
}

/** A date, or only a year ("2008") — returned as "YYYY". */
export function parseActualStart(value: EmasCell): string | undefined {
  const asNumber = typeof value === "number" ? value : /^\s*(\d{4})\s*$/.exec(String(value ?? ""))?.[1]
  if (asNumber !== undefined && Number(asNumber) >= 1950 && Number(asNumber) <= 2100) return String(asNumber)
  return parseSheetDate(value)
}

/** "6 il 8 ay 23 gün"; any of the three parts may be missing, extra words are ignored. */
export function parseDurationText(value: EmasCell): WorkExperienceDuration | undefined {
  const text = cleanText(value)
  if (!text) return undefined
  // A bracketed figure wins: "10 iyun (4 il 8 ay 19 gün)".
  const source = /\(([^)]*\bil\b[^)]*)\)/.exec(text)?.[1] ?? text
  const part = (unit: string) => new RegExp(`(\\d+)\\s*${unit}`).exec(source)?.[1]
  const [years, months, days] = [part("il"), part("ay"), part("gün")]
  if (years === undefined && months === undefined && days === undefined) return undefined
  return { years: Number(years ?? 0), months: Number(months ?? 0), days: Number(days ?? 0) }
}

export function buildPeriods(finCode: string, rows: SheetRow[]): PreviousEmployment[] {
  const out: PreviousEmployment[] = []
  rows.forEach((row, index) => {
    const organization = cleanText(row[PERIOD_COL.organization])
    const counted = cleanText(row[PERIOD_COL.counted]) === "Bəli"
    // The counted part may be shorter than the contract (cut off at the hire date).
    const range = counted ? cleanText(row[PERIOD_COL.countedPeriod])?.split(/\s*[–-]\s*/) : undefined
    const startDate = parseSheetDate(range?.[0] ?? row[PERIOD_COL.start])
    const endDate = parseSheetDate(range?.[1] ?? row[PERIOD_COL.end])
    if (!organization || !startDate || !endDate) return
    const taxId = cleanText(row[PERIOD_COL.taxId])
    out.push({
      id: `PE-${finCode.toUpperCase()}-${index + 1}`,
      organization,
      taxId,
      position: cleanText(row[PERIOD_COL.position]),
      startDate,
      endDate,
      counted,
      ownCompany: taxId === OWN_COMPANY_TAX_ID || undefined,
      note: cleanText(row[PERIOD_COL.note]),
    })
  })
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export interface ImportChange {
  field: string
  oldValue: string
  newValue: string
}

export interface HrImportResult {
  profile: EmployeeProfile
  changes: ImportChange[]
  warnings: string[]
  leaveDaysBefore: number
  leaveDaysAfter: number
  /** Leave days if HR confirms the pending work-book figure. */
  leaveDaysIfConfirmed?: number
}

export const formatSlashed = (d: WorkExperienceDuration | undefined) => (d ? `${d.years}/${d.months}/${d.days}` : "—")

export function computeHrImport(
  existing: EmployeeProfile,
  row: SheetRow,
  periodRows: SheetRow[],
  now: Date = new Date()
): HrImportResult {
  const profile: EmployeeProfile = structuredClone(existing)
  const changes: ImportChange[] = []
  const warnings: string[] = []
  const record = (field: string, oldValue: string | undefined, newValue: string | undefined) =>
    changes.push({ field, oldValue: oldValue || "—", newValue: newValue || "—" })
  const { labourLaw, employment } = profile

  const hireDate = parseSheetDate(row[HR_COL.hireDate])
  if (hireDate && hireDate !== employment.hireDate) {
    record("employment.hireDate", employment.hireDate, hireDate)
    employment.hireDate = hireDate
  }

  const rawStart = cleanText(row[HR_COL.actualStart])
  const actualStart = parseActualStart(row[HR_COL.actualStart])
  if (rawStart && !actualStart) warnings.push(`Faktiki staj oxunmadı: "${rawStart}"`)
  if (actualStart) {
    // A year is compared with the hire year, a date with the hire date.
    if (actualStart > employment.hireDate.slice(0, actualStart.length)) {
      warnings.push(`Faktiki başlama (${actualStart}) işə qəbuldan sonradır, yazılmadı`)
    } else if (actualStart !== employment.actualStartDate) {
      record("employment.actualStartDate", employment.actualStartDate, actualStart)
      employment.actualStartDate = actualStart
    }
  }

  const periods = buildPeriods(profile.personal.finCode, periodRows)
  if (periods.length > 0 && JSON.stringify(periods) !== JSON.stringify(labourLaw.previousEmployments ?? [])) {
    record(
      "labourLaw.previousEmployments",
      `${labourLaw.previousEmployments?.length ?? 0} dövr`,
      `${periods.length} dövr`
    )
    labourLaw.previousEmployments = periods
  }

  const official = parseDurationText(row[HR_COL.official])
  if (!official) warnings.push("ƏMAS əvvəlki stajı faylda yoxdur: Novadakı rəqəm saxlanılır")
  else if (!sameDuration(official, labourLaw.officialPreviousExperience)) {
    record(
      "labourLaw.officialPreviousExperience",
      formatSlashed(labourLaw.officialPreviousExperience),
      formatSlashed(official)
    )
    labourLaw.officialPreviousExperience = official
  }

  const rawTotal = cleanText(row[HR_COL.declaredTotal])
  const declared = parseDurationText(row[HR_COL.declaredTotal])
  if (rawTotal && !declared) warnings.push(`Ümumi iş stajı oxunmadı: "${rawTotal}"`)
  if (rawTotal && declared && !/^\d+\s*(il|ay|gün)/.test(rawTotal)) {
    warnings.push(`Ümumi iş stajı qeyri-standart yazılıb, yoxlayın: "${rawTotal}"`)
  }
  const reviewed = labourLaw.workBook && (labourLaw.workBook.status !== "pending" || labourLaw.workBook.reviewedBy)
  if (!reviewed) {
    const base = labourLaw.officialPreviousExperience ?? labourLaw.previousWorkExperience
    const larger = declared && durationToDays(declared) - durationToDays(base) > TOLERANCE_DAYS
    if (declared && !larger && durationToDays(base) - durationToDays(declared) > TOLERANCE_DAYS) {
      warnings.push("HR rəqəmi ƏMAS-dan kiçikdir: nəzərə alınmır")
    }
    const next: WorkBookExperience | undefined = larger
      ? { status: "pending", declaredTotal: declared, declaredAsOf: HR_IMPORT_DATE, periods: [], note: HR_IMPORT_NOTE }
      : undefined
    if (JSON.stringify(next) !== JSON.stringify(labourLaw.workBook)) {
      record(
        "labourLaw.workBook",
        formatSlashed(labourLaw.workBook?.declaredTotal),
        next ? `${formatSlashed(next.declaredTotal)} (təsdiq gözləyir)` : "—"
      )
      labourLaw.workBook = next
    }
  }

  const disability = parseDisability(row[HR_COL.disability])
  if (disability && !labourLaw.hasDisability) {
    record("labourLaw.hasDisability", "xeyr", `bəli, ${disability.group} qrup`)
    labourLaw.hasDisability = true
    labourLaw.disabilityGroup = disability.group
  }
  if (cleanText(row[HR_COL.veteran]) === "Bəli" && !labourLaw.veteranStatus) {
    record("labourLaw.veteranStatus", undefined, "warVeteran")
    labourLaw.veteranStatus = "warVeteran"
  }

  const effective = resolveExperience(profile, now).effective
  if (!sameDuration(effective, labourLaw.previousWorkExperience)) {
    record(
      "labourLaw.previousWorkExperience",
      formatSlashed(labourLaw.previousWorkExperience),
      formatSlashed(effective)
    )
    labourLaw.previousWorkExperience = effective
  }

  const leaveDaysBefore = resolveAnnualLeaveEntitlement(existing, now).totalDays
  const entitlement = resolveAnnualLeaveEntitlement(profile, now)
  if (entitlement.totalDays !== leaveDaysBefore) {
    const seniority = entitlement.components
      .filter((c) => c.article === "Art. 116")
      .reduce((sum, c) => sum + c.days, 0)
    profile.leave.annualLeaveEntitlement = entitlement.totalDays - seniority
    profile.leave.additionalLeaveEntitlement = seniority
  }

  let leaveDaysIfConfirmed: number | undefined
  if (labourLaw.workBook?.status === "pending") {
    const confirmed = structuredClone(profile)
    confirmed.labourLaw.workBook!.status = "confirmed"
    confirmed.labourLaw.previousWorkExperience = resolveExperience(confirmed, now).effective
    leaveDaysIfConfirmed = resolveAnnualLeaveEntitlement(confirmed, now).totalDays
  }

  if (changes.length > 0) {
    const stamp = now.toISOString()
    const entries: AuditLogEntry[] = changes.map((change, i) => ({
      id: `AUD-${profile.id}-HR-${stamp}-${i + 1}`,
      timestamp: stamp,
      actor: HR_IMPORT_ACTOR,
      action: "hr.import",
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
    }))
    profile.auditLog = [...(profile.auditLog ?? []), ...entries]
  }

  return {
    profile,
    changes,
    warnings,
    leaveDaysBefore,
    leaveDaysAfter: entitlement.totalDays,
    leaveDaysIfConfirmed,
  }
}
