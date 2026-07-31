import { CalendarPlus, CalendarClock, CalendarMinus, CalendarCheck, Hourglass } from "lucide-react"
import { getFormatter, getTranslations } from "next-intl/server"

import { KpiCard } from "@/components/common/kpi-card"
import { getOrganizationLeaveDaysSummary } from "@/lib/leave/leave-balance-service"
import { normalizeLeaveAmount } from "@/lib/leave/normalize-leave-amount"

/**
 * Org-wide Leave visibility — same Server Component + direct-service-call
 * convention as KpiSection (no Server Action indirection needed; this
 * already runs on the server). Reused as-is on both the Dashboard and the
 * HR Leave Management page (/leave) — same org-wide totals belong in both
 * places, so this stays the one component either renders rather than each
 * having its own copy. Scoped to DAYS-unit leave types only — see
 * OrgLeaveDaysSummary's doc comment for why (mixing in HOURS-unit types
 * would silently sum incompatible units). Opening Balance is no longer
 * "correctly zero until ledger data exists" — getOrganizationLeaveDaysSummary
 * now sums computeLeaveBalance per employee, which falls back to each
 * employee's computed Annual Leave entitlement when no opening-balance
 * ledger row has been imported for them yet, so this reflects real
 * (if not yet ledger-recorded) entitlement.
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
    // This component formats through next-intl's number formatter
    // directly rather than formatLeaveUnitAmount, so it still needs to
    // call the shared normalizer explicitly rather than getting it for
    // free — but it's the same one function, not a re-derived rule.
    return `${format.number(normalizeLeaveAmount(value))} ${t("daysUnit")}`
  }

  return (
    // Same breakpoints as every other 4-metric KpiCard row in the Leave
    // module (Employee tab, request wizard) — mobile: 1 col, tablet (sm):
    // 2x2, desktop (lg): all 4 in one row. The 5th (Pending) wraps onto its
    // own row rather than forcing a 5-column grid — five columns crushed
    // these cards' longer labels illegibly at this width.
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      <KpiCard
        label={t("pending")}
        value={days(summary.totalPending)}
        icon={Hourglass}
        tooltip={tTooltips("pending")}
      />
    </div>
  )
}
