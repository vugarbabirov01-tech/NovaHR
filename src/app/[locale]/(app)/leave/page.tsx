import type { Metadata } from "next"
import { CalendarCheck2 } from "lucide-react"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { KpiCard } from "@/components/common/kpi-card"
import { LeaveSummarySection } from "@/components/dashboard/leave-summary-section"
import { LeaveRequestsTable, type LeaveRequestRow } from "@/components/leave/leave-requests-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAllLeaveRequestsAction } from "@/lib/leave/leave-request-actions"
import { getActiveLeaveTypesAction } from "@/lib/leave/leave-balance-actions"
import { getEmployeeById } from "@/data/employee-directory"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Pages.leave" })
  const common = await getTranslations({ locale, namespace: "Common" })

  return { title: `${t("title")} | ${common("appName")}` }
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
}

/**
 * The HR-facing counterpart to the Employee Profile Leave tab — same
 * backend (leave-request-actions.ts, leave-balance-actions.ts,
 * leave-balance-service.ts), scoped org-wide instead of to one employee.
 * Nothing here re-implements the ledger, balance, or request logic; this
 * page only fetches, resolves employee names server-side (safe here, not
 * in the client table — see leave-requests-table.tsx's doc comment), and
 * renders. Employee-specific detail (balance breakdown, own history, the
 * request wizard) stays exclusively in leave-tab.tsx — this page links out
 * to it (?tab=leave) rather than duplicating it.
 */
export default async function LeavePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Pages.leave")
  const tDashboard = await getTranslations("Leave.dashboard")

  const [requests, leaveTypes] = await Promise.all([getAllLeaveRequestsAction(), getActiveLeaveTypesAction()])
  const leaveTypeById = new Map(leaveTypes.map((leaveType) => [leaveType.id, leaveType]))

  const rows: LeaveRequestRow[] = requests.map((request) => {
    const profile = getEmployeeById(request.employeeId)
    const leaveType = leaveTypeById.get(request.leaveTypeId)
    return {
      id: request.id,
      employeeId: request.employeeId,
      employeeName: profile ? `${profile.personal.firstName} ${profile.personal.lastName}` : request.employeeId,
      employeeInitials: profile ? initials(profile.personal.firstName, profile.personal.lastName) : "—",
      employeeDepartment: profile?.employment.department ?? "",
      leaveTypeName: leaveType?.name ?? request.leaveTypeId,
      unit: leaveType?.unit ?? "DAYS",
      startDate: request.startDate.toISOString(),
      endDate: request.endDate.toISOString(),
      requestedUnits: request.requestedUnits,
      status: request.status,
    }
  })

  const pendingCount = requests.filter((request) => request.status === "PENDING_APPROVAL").length

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} description={t("description")} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={tDashboard("pendingApprovals")} value={String(pendingCount)} icon={CalendarCheck2} />
      </div>

      <LeaveSummarySection />

      <Card>
        <CardHeader>
          <CardTitle>{tDashboard("table.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveRequestsTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  )
}
