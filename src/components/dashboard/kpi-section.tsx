import { Users, UserCheck, CalendarClock, UserPlus } from "lucide-react"
import { getFormatter, getTranslations } from "next-intl/server"

import { KpiCard } from "@/components/common/kpi-card"
import { kpiStats } from "@/data/dashboard-stats"

export async function KpiSection() {
  const t = await getTranslations("Kpi")
  const format = await getFormatter()
  const deltaLabel = t("vsLastMonth")

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label={t("totalEmployees")}
        value={format.number(kpiStats.totalEmployees.value)}
        delta={kpiStats.totalEmployees.delta}
        deltaLabel={deltaLabel}
        icon={Users}
      />
      <KpiCard
        label={t("activeEmployees")}
        value={format.number(kpiStats.activeEmployees.value)}
        delta={kpiStats.activeEmployees.delta}
        deltaLabel={deltaLabel}
        icon={UserCheck}
      />
      <KpiCard
        label={t("onLeave")}
        value={format.number(kpiStats.onLeave.value)}
        delta={kpiStats.onLeave.delta}
        deltaLabel={deltaLabel}
        icon={CalendarClock}
      />
      <KpiCard
        label={t("newHires")}
        value={format.number(kpiStats.newHires.value)}
        delta={kpiStats.newHires.delta}
        deltaLabel={deltaLabel}
        icon={UserPlus}
      />
    </div>
  )
}
