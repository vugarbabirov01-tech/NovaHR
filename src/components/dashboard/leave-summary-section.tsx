import { CalendarPlus, CalendarClock, CalendarMinus, CalendarCheck } from "lucide-react"
import { getFormatter, getTranslations } from "next-intl/server"

import { KpiCard } from "@/components/common/kpi-card"
import { getOrganizationLeaveDaysSummary } from "@/lib/leave/leave-balance-service"

/**
 * Org-wide Leave visibility for the Dashboard — same Server Component +
 * direct-service-call convention as KpiSection (no Server Action
 * indirection needed; this already runs on the server). Scoped to
 * DAYS-unit leave types only — see OrgLeaveDaysSummary's doc comment for
 * why (mixing in HOURS-unit types would silently sum incompatible units).
 * Zeros are the correct, expected result until real ledger data exists —
 * not a bug.
 */
export async function LeaveSummarySection() {
  const t = await getTranslations("LeaveSummary")
  const format = await getFormatter()
  const summary = await getOrganizationLeaveDaysSummary()

  function days(value: number): string {
    return `${format.number(value)} ${t("daysUnit")}`
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label={t("openingBalance")} value={days(summary.totalOpeningBalance)} icon={CalendarPlus} />
      <KpiCard label={t("carriedForward")} value={days(summary.totalCarriedForward)} icon={CalendarClock} />
      <KpiCard label={t("taken")} value={days(summary.totalTaken)} icon={CalendarMinus} />
      <KpiCard label={t("remaining")} value={days(summary.totalRemaining)} icon={CalendarCheck} />
    </div>
  )
}
