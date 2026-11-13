import type { DisabilityGroup, WorkExperienceDuration } from "@/types/employee-profile"

/** ƏMAS exports use this literal wherever the source had no value. */
export const EMAS_NO_DATA = "Məlumat yoxdur"

export type EmasCell = string | number | null | undefined

/** Trimmed text, or undefined for blank cells and the "Məlumat yoxdur" marker. */
export function cleanText(value: EmasCell): string | undefined {
  if (value === null || value === undefined) return undefined
  const text = String(value).replace(/\s+/g, " ").trim()
  if (text === "" || text === EMAS_NO_DATA || text === "—" || text === "-") return undefined
  return text
}

/** "02.06.2014" -> "2014-06-02". Anything else (or an impossible date) -> undefined. */
export function parseEmasDate(value: EmasCell): string | undefined {
  const text = cleanText(value)
  if (!text) return undefined
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text)
  if (!match) return undefined
  const [, d, m, y] = match
  const day = Number(d)
  const month = Number(m)
  const year = Number(y)
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return undefined
  }
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** "6 il, 8 ay, 23 gün" -> { years: 6, months: 8, days: 23 }. */
export function parseExperience(value: EmasCell): WorkExperienceDuration | undefined {
  const text = cleanText(value)
  if (!text) return undefined
  const match = /^(\d+)\s*il,\s*(\d+)\s*ay,\s*(\d+)\s*gün$/i.exec(text)
  if (!match) return undefined
  return { years: Number(match[1]), months: Number(match[2]), days: Number(match[3]) }
}

export interface ParsedLeave {
  /** Base annual leave days ("əsas"). */
  base: number
  /** Extra days for length of service ("staja görə"); 0 when absent. */
  seniority: number
}

/** "23 gün (əsas 21 + staja görə 2)" -> { base: 21, seniority: 2 }. */
export function parseLeave(value: EmasCell): ParsedLeave | undefined {
  const text = cleanText(value)
  if (!text) return undefined
  const base = /əsas\s+(\d+)/i.exec(text)
  if (!base) return undefined
  const seniority = /staja görə\s+(\d+)/i.exec(text)
  return { base: Number(base[1]), seniority: seniority ? Number(seniority[1]) : 0 }
}

export interface ParsedDisability {
  group: DisabilityGroup
  /** The cause text in the source's parentheses, when present. */
  cause?: string
}

/**
 * ƏMAS gives a function-loss percentage band; Nova stores only the group.
 * 81-100% -> I, 61-80% -> II, 31-60% -> III (agreed 2026-11-13).
 */
export function parseDisability(value: EmasCell): ParsedDisability | undefined {
  const text = cleanText(value)
  if (!text) return undefined
  const band = /(\d+)-(\d+)\s*faiz/i.exec(text)
  if (!band) return undefined
  const upper = Number(band[2])
  const group: DisabilityGroup | undefined = upper >= 81 ? "I" : upper >= 61 ? "II" : upper >= 31 ? "III" : undefined
  if (!group) return undefined
  const cause = /\(səbəb:\s*(.+)\)\s*$/i.exec(text)
  return { group, cause: cause ? cause[1].trim() : undefined }
}

export function parseGross(value: EmasCell): number | undefined {
  if (value === null || value === undefined || value === "") return undefined
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Upper-case ƏMAS names to display case with Azerbaijani casing rules (İ/I, Ə). */
export function toAzTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLocaleLowerCase("az")
      return lower.charAt(0).toLocaleUpperCase("az") + lower.slice(1)
    })
    .join(" ")
}

export interface SplitName {
  firstName: string
  lastName: string
  fatherName: string
  gender: "male" | "female" | undefined
}

/**
 * ƏMAS order is "AD SOYAD ATA ADI OĞLU/QIZI" (e.g. "MURAD HEYDƏROV POLAD
 * OĞLU"): the trailing OĞLU/QIZI both marks the patronymic and gives gender.
 */
export function splitFullName(fullName: string): SplitName | undefined {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 3) return undefined
  const last = parts[parts.length - 1].toLocaleLowerCase("az")
  let gender: SplitName["gender"]
  let core = parts
  if (last === "oğlu" || last === "qızı") {
    gender = last === "oğlu" ? "male" : "female"
    core = parts.slice(0, -1)
  }
  if (core.length < 3) return undefined
  return {
    firstName: toAzTitleCase(core[0]),
    lastName: toAzTitleCase(core[1]),
    fatherName: toAzTitleCase(core.slice(2).join(" ")),
    gender,
  }
}
