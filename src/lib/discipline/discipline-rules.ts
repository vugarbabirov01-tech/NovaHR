/** Disciplinary measures under the Labour Code (art. 189). Dismissal is a separate flow (termination). */
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

/**
 * A measure counts as lifted if the employee gets no new one within a year
 * (art. 191): the last day it is in force is one year after it was imposed.
 */
export function disciplineExpiryDate(issuedDate: string): string {
  const [year, month, day] = issuedDate.split("-").map(Number)
  const next = new Date(Date.UTC(year + 1, month - 1, day))
  // 29 Feb + 1 year rolls into March: clamp back to the end of February.
  if (next.getUTCMonth() !== month - 1) next.setUTCDate(0)
  return next.toISOString().slice(0, 10)
}

export function isDisciplineInForce(issuedDate: string, today: string): boolean {
  return today <= disciplineExpiryDate(issuedDate)
}
