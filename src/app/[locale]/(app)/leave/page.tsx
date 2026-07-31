import type { Metadata } from "next"
import { CalendarCheck2, CalendarDays, CalendarMinus, CalendarPlus, CheckCircle2, Users, XCircle } from "lucide-react"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { KpiCard } from "@/components/common/kpi-card"
import { NewLeaveRequestButton } from "@/components/leave/new-leave-request-button"
import { LeaveRequestsTable, type LeaveRequestRow } from "@/components/leave/leave-requests-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAllLeaveRequestsAction } from "@/lib/leave/leave-request-actions"
import { getActiveLeaveTypesAction } from "@/lib/leave/leave-balance-actions"
import { calculateReturnToWork } from "@/lib/leave/leave-policy-resolution-service"
import { computeLeaveDashboardKpis } from "@/lib/leave/leave-dashboard-kpis"
import { employeeDirectory, getEmployeeById } from "@/data/employee-directory"

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
 * The central HR Leave Dashboard — monitor leave, approve requests, view
 * company-wide statistics, and start new requests. Deliberately does NOT
 * show any individual employee's balance (Initial/Previous Year/Used/
 * Current) — those are the Employee Leave tab's job (leave-tab.tsx); this
 * page only ever shows company-wide KPIs and the request queue. See
 * computeLeaveDashboardKpis's own doc comment for why these are pure
 * derivations of the same getAllLeaveRequestsAction data this page already
 * fetched, not a second query.
 */
export default async function LeavePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Pages.leave")
  const tDashboard = await getTranslations("Leave.dashboard")

  const [requests, leaveTypes] = await Promise.all([getAllLeaveRequestsAction(), getActiveLeaveTypesAction()])
  const leaveTypeById = new Map(leaveTypes.map((leaveType) => [leaveType.id, leaveType]))
  const kpis = computeLeaveDashboardKpis(requests)

  const rows: LeaveRequestRow[] = await Promise.all(
    requests.map(async (request) => {
      const profile = getEmployeeById(request.employeeId)
      const leaveType = leaveTypeById.get(request.leaveTypeId)
      // Reuses the same Leave Policy Resolution engine the request wizard's
      // Review step calls (evaluateLeaveRequest) — Working Days is a real
      // calculated figure (weekends/holidays excluded per this employee's
      // actual schedule), never re-derived from requestedUnits.
      const returnToWork = await calculateReturnToWork(request.startDate, request.requestedUnits, {
        workScheduleLabel: profile?.employment.workSchedule,
        companyId: request.companyId ?? undefined,
        branchId: request.branchId ?? undefined,
      })
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
        workingDays: returnToWork.workingDaysInRange,
        status: request.status,
        // No authenticated approver/submitter identity exists yet anywhere
        // in this codebase — every write in the Leave module already
        // records a fixed "HR" actor (see leave-request-actions.ts,
        // leave-request-decision-service.ts). Single decision step today,
        // hence "1/1" rather than a fabricated multi-level chain.
        requestedBy: "HR",
        approvalLevel: "1/1",
      }
    })
  )

  // Only employees still on the payroll are assignable from "Yeni
  // Məzuniyyət" — this is a picker-list filter, not a business-logic
  // change (submission validation itself is unchanged). finCode (not
  // department) travels with each option — department is no longer a
  // search field or a displayed hint in the Employee step's picker.
  const employeeOptions = employeeDirectory
    .filter((employee) => employee.employmentStatus !== "terminated")
    .map((employee) => ({
      id: employee.id,
      name: `${employee.personal.firstName} ${employee.personal.lastName}`,
      finCode: employee.personal.finCode,
    }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle title={t("title")} description={t("description")} />
        <NewLeaveRequestButton employeeOptions={employeeOptions} leaveTypes={leaveTypes} />
      </div>

      {/* Company-wide HR KPIs only — never an individual employee's
       * balance. Same responsive tiering as every other Leave KPI row:
       * mobile 1 col, tablet 2x2, desktop 4-in-a-row (wraps to a second
       * row of 3). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={tDashboard("pendingApprovals")} value={String(kpis.pendingApprovals)} icon={CalendarCheck2} />
        <KpiCard label={tDashboard("kpis.employeesOnLeave")} value={String(kpis.employeesOnLeave)} icon={Users} />
        <KpiCard
          label={tDashboard("kpis.startingThisWeek")}
          value={String(kpis.startingThisWeek)}
          icon={CalendarPlus}
        />
        <KpiCard label={tDashboard("kpis.endingThisWeek")} value={String(kpis.endingThisWeek)} icon={CalendarMinus} />
        <KpiCard label={tDashboard("kpis.leavesThisMonth")} value={String(kpis.leavesThisMonth)} icon={CalendarDays} />
        <KpiCard
          label={tDashboard("kpis.approvedThisMonth")}
          value={String(kpis.approvedThisMonth)}
          icon={CheckCircle2}
        />
        <KpiCard label={tDashboard("kpis.rejectedThisMonth")} value={String(kpis.rejectedThisMonth)} icon={XCircle} />
      </div>

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
