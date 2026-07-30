import type { LeaveUnit } from "@/generated/prisma/enums"

type UnitTranslator = (key: "days" | "hours", values: { count: number }) => string

/**
 * The one place a DAYS/HOURS amount becomes display text — the Employee
 * Profile Leave tab, the request wizard's review step, and the HR /leave
 * requests table each used to carry their own copy of this same ternary
 * (one of them even against a second, redundant set of translation keys).
 * Every caller passes its own useTranslations("Employees.profile.leave")
 * instance so all three surfaces read the exact same words for the exact
 * same amount.
 */
export function formatLeaveUnitAmount(t: UnitTranslator, value: number, unit: LeaveUnit): string {
  return unit === "HOURS" ? t("hours", { count: value }) : t("days", { count: value })
}
