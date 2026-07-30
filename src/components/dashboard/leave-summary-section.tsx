import { CalendarPlus, CalendarClock, CalendarMinus, CalendarCheck } from "lucide-react"
import { getFormatter, getTranslations } from "next-intl/server"

import { KpiCard } from "@/components/common/kpi-card"
import { getOrganizationLeaveDaysSummary } from "@/lib/leave/leave-balance-service"

/**
 * Org-wide Leave visibility — same Server Component + direct-service-call
 * convention as KpiSection (no Server Action indirection needed; this
 * already runs on the server). Reused as-is on both the Dashboard and the
 * HR Leave Management page (/leave) — same org-wide totals belong in both
 * places, so this stays the one component either renders rather than each
 * having its own copy. Scoped to DAYS-unit leave types only — see
 * OrgLeaveDaysSummary's doc comment for why (mixing in HOURS-unit types
 * would silently sum incompatible units). Zeros are the correct, expected
 * result until real ledger data exists — not a bug.
 */
export async function LeaveSummarySection() {
  const t = await getTranslations("LeaveSummary")
  // Same explanations as the Employee Profile Leave tab and the request
  // wizard's balance section — one tooltip namespace, reused everywhere
  // these four terms appear, never restated.
  const tTooltips = await getTranslations("Employees.profile.leave.tooltips")
  const format = await getFormatter()
  const summary = await getOrganizationLeaveDaysSummary()
  const year = new Date().getFullYear()

  function days(value: number): string {
    return `${format.number(value)} ${t("daysUnit")}`
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label={t("openingBalance")}
        value={days(summary.totalOpeningBalance)}
        icon={CalendarPlus}
        tooltip={tTooltips("openingBalance", { year })}
      />
      <KpiCard
        label={t("carriedForward")}
        value={days(summary.totalCarriedForward)}
        icon={CalendarClock}
        tooltip={tTooltips("carriedForward")}
      />
      <KpiCard label={t("taken")} value={days(summary.totalTaken)} icon={CalendarMinus} tooltip={tTooltips("taken")} />
      <KpiCard
        label={t("remaining")}
        value={days(summary.totalRemaining)}
        icon={CalendarCheck}
        tooltip={tTooltips("remaining")}
      />
    </div>
  )
}
