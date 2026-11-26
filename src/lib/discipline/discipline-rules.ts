/**
 * Records kept on the Discipline tab. REPRIMAND and SEVERE_REPRIMAND (the severe
 * reprimand with a final warning) are penalties under Labour Code art. 186.2;
 * WARNING is a written warning, which art. 186.3 says is not a penalty.
 * Dismissal is a separate flow (termination); fines are not used.
 */
export const DISCIPLINE_TYPES = ["WARNING", "REPRIMAND", "SEVERE_REPRIMAND"] as const
export type DisciplineType = (typeof DISCIPLINE_TYPES)[number]

export type DisciplineErrorCode =
  | "invalidType"
  | "invalidDate"
  | "futureDate"
  | "issuedBeforeViolation"
  | "reasonRequired"
  | "notFound"
  | "unknown"

export interface DisciplineInput {
  type: string
  issuedDate: string
  violationDate: string
  reason: string
  basis?: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function isDisciplineType(value: string): value is DisciplineType {
  return (DISCIPLINE_TYPES as readonly string[]).includes(value)
}

/** `today` is yyyy-mm-dd; returns the first problem found, or null. */
export function validateDisciplineInput(input: DisciplineInput, today: string): DisciplineErrorCode | null {
  if (!isDisciplineType(input.type)) return "invalidType"
  if (!isValidDate(input.issuedDate) || !isValidDate(input.violationDate)) return "invalidDate"
  if (input.issuedDate > today || input.violationDate > today) return "futureDate"
  if (input.issuedDate < input.violationDate) return "issuedBeforeViolation"
  if (!input.reason.trim()) return "reasonRequired"
  return null
}

/** Art. 190.1: a penalty is in force for six months from the day it is imposed. */
export const DISCIPLINE_FORCE_MONTHS = 6

/** The last day the penalty is in force. */
export function disciplineExpiryDate(issuedDate: string): string {
  const [year, month, day] = issuedDate.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1 + DISCIPLINE_FORCE_MONTHS, day))
  // 31 Aug + 6 months would roll into March: clamp back to the end of February.
  if (next.getUTCDate() !== day) next.setUTCDate(0)
  return next.toISOString().slice(0, 10)
}

export function isDisciplineInForce(issuedDate: string, today: string): boolean {
  return today <= disciplineExpiryDate(issuedDate)
}

export function isPenalty(type: string): boolean {
  return type === "REPRIMAND" || type === "SEVERE_REPRIMAND"
}

/**
 * What an employee card shows: a penalty while it is in force, or a written
 * warning for the same six months. A warning is not a penalty in law; showing
 * it for six months is a company choice.
 */
export interface ActivePenalty {
  type: string
  /** Last day in force (yyyy-mm-dd). */
  until: string
}

/** The one record to flag for an employee: the most severe still shown, then the one lasting longest.
 * Any penalty outranks a written warning. */
export function activePenalty(
  actions: { type: string; issuedDate: string }[],
  today: string
): ActivePenalty | undefined {
  const rank = (type: string) => DISCIPLINE_TYPES.indexOf(type as DisciplineType)
  return actions
    .filter((a) => isDisciplineType(a.type) && a.issuedDate <= today && isDisciplineInForce(a.issuedDate, today))
    .map((a) => ({ type: a.type, until: disciplineExpiryDate(a.issuedDate) }))
    .sort((a, b) => rank(b.type) - rank(a.type) || b.until.localeCompare(a.until))[0]
}
