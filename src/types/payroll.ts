// Mirrors the Prisma PayrollPeriodStatus enum for the client boundary — kept
// as a plain string union (not an import from @/generated/prisma/enums) so
// Client Components never need to reach into generated Prisma code.
export type PayrollPeriodStatus = "DRAFT" | "CALCULATED" | "APPROVED" | "PAID" | "CLOSED"

/** One table row — a PayrollEmployeeRecord joined against its Employee's
 * current display fields (name/FIN/company/work location/position/photo).
 * baseSalary/additions/deductions/grossAmount/netAmount all come from the
 * record itself (the period's snapshot), never recomputed from the live
 * Employee. */
export interface PayrollEmployeeRow {
  id: string
  employeeId: string
  /** "Soyad Ad Ata adı" — see getFullLegalName (src/lib/employees.ts). */
  fullName: string
  /** Kept alongside fullName only for getInitials(firstName, lastName) —
   * the same avatar-initials convention Employee Card/List already use. */
  firstName: string
  lastName: string
  finCode: string
  company: string
  workLocation: string
  position: string
  photoUrl?: string
  baseSalary: number
  currency: string
  additions: number
  deductions: number
  grossAmount: number
  netAmount: number
  status: PayrollPeriodStatus
}

export interface PayrollPeriodSummary {
  year: number
  month: number
  startDate: string
  endDate: string
  status: PayrollPeriodStatus
  employeeCount: number
  totalBaseSalary: number
  totalAdditions: number
  totalNet: number
}
