import type { EmployeeProfile, EmploymentHistoryEvent } from "@/types/employee-profile"

/**
 * Deliberately not `amount.toLocaleString("az-AZ")` — that resolves against
 * whatever ICU data the running engine has for that locale, which is free
 * to differ between the server (where this also runs, building the history
 * event's persisted text) and a viewer's browser (see the same gotcha
 * already documented in import-drafts-list.tsx's formatDraftTimestamp).
 * A manually grouped string renders identically everywhere, which matters
 * even more here since the result gets written into the database, not just
 * displayed.
 */
export function formatAzn(amount: number): string {
  const [whole, fraction] = amount.toFixed(2).split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${fraction === "00" ? grouped : `${grouped},${fraction}`} AZN`
}

/**
 * The one place Salary Import touches an EmployeeProfile — everything
 * except payroll.baseSalary/currency/salaryEffectiveDate is spread through
 * unchanged (personal, the rest of employment, labourLaw, leave, documents,
 * education, assets, notes, auditLog, quickStats), and a "salary-change"
 * EmploymentHistoryEvent is appended so the old value isn't simply
 * overwritten — employment.history is the same mechanism hire/promotion/
 * transfer events already use (see employee-wizard-mapper.ts), and the
 * Profile's Employment/Overview tabs already render "salary-change" events
 * (historyIcons in both tabs), so nothing there needs to change either.
 */
export function applySalaryUpdate(
  profile: EmployeeProfile,
  newSalary: number,
  effectiveDate: string | undefined
): EmployeeProfile {
  const previousSalary = profile.payroll.baseSalary
  const date = effectiveDate ?? new Date().toISOString().slice(0, 10)

  const event: EmploymentHistoryEvent = {
    id: `EH-${profile.employment.employeeNumber}-${profile.employment.history.length + 1}`,
    date,
    type: "salary-change",
    title: `${formatAzn(previousSalary)} → ${formatAzn(newSalary)}`,
    description:
      previousSalary > 0
        ? `Toplu idxal vasitəsilə əmək haqqı ${formatAzn(previousSalary)}-dən ${formatAzn(newSalary)}-ə dəyişdirildi.`
        : `Toplu idxal vasitəsilə əmək haqqı ${formatAzn(newSalary)} olaraq təyin edildi.`,
  }

  return {
    ...profile,
    employment: {
      ...profile.employment,
      history: [...profile.employment.history, event],
    },
    payroll: {
      ...profile.payroll,
      baseSalary: newSalary,
      currency: "AZN",
      salaryEffectiveDate: date,
    },
  }
}
