import { normalizeLeaveAmount } from "@/lib/leave/normalize-leave-amount"
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
  // Belt-and-suspenders: -0 is normalized at its source in
  // leave-balance-service.ts, but this is the one function every leave
  // amount in the app renders through, so it's also the last place that
  // could ever let a "-0" reach the screen — negating or subtracting to
  // exactly zero elsewhere (e.g. balance.remaining - numberOfDays on the
  // Review step) is a real, easy-to-reintroduce way to produce it.
  const normalized = normalizeLeaveAmount(value)
  return unit === "HOURS" ? t("hours", { count: normalized }) : t("days", { count: normalized })
}
