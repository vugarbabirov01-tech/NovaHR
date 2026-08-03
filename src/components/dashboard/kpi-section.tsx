import { Users, UserCheck, CalendarClock, UserPlus } from "lucide-react"
import { getFormatter, getTranslations } from "next-intl/server"

import { KpiCard } from "@/components/common/kpi-card"
import { getDashboardKpis } from "@/lib/dashboard-service"

export async function KpiSection() {
  const t = await getTranslations("Kpi")
  const format = await getFormatter()
  const kpis = await getDashboardKpis()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label={t("totalEmployees")} value={format.number(kpis.totalEmployees)} icon={Users} />
      <KpiCard label={t("activeEmployees")} value={format.number(kpis.activeEmployees)} icon={UserCheck} />
      <KpiCard label={t("onLeave")} value={format.number(kpis.onLeave)} icon={CalendarClock} />
      <KpiCard label={t("newHires")} value={format.number(kpis.newHires)} icon={UserPlus} />
    </div>
  )
}
