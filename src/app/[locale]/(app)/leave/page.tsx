import type { Metadata } from "next"
import { CalendarCheck2, CalendarDays, CalendarMinus, CalendarPlus, CheckCircle2, Users, XCircle } from "lucide-react"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { KpiCard } from "@/components/common/kpi-card"
import { NewLeaveRequestButton } from "@/components/leave/new-leave-request-button"
import { CurrentlyOnLeaveTable, type CurrentlyOnLeaveRow } from "@/components/leave/currently-on-leave-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAllLeaveRequestsAction } from "@/lib/leave/leave-request-actions"
import { getActiveLeaveTypesAction } from "@/lib/leave/leave-balance-actions"
import { calculateReturnToWork } from "@/lib/leave/leave-policy-resolution-service"
import { computeLeaveDashboardKpis } from "@/lib/leave/leave-dashboard-kpis"
import { findActiveLeaveByEmployee, calendarDaysUntil } from "@/lib/leave/leave-active-status"
import { findAllEmployees, findEmployeeById } from "@/repositories/employee-repository"

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
 * The central HR Leave Dashboard — company-wide statistics, who's currently
 * out and when they're back, and starting new requests. Deliberately does
 * NOT show any individual employee's balance (Initial/Previous Year/Used/
 * Current) — those are the Employee Leave tab's job (leave-tab.tsx). See
 * computeLeaveDashboardKpis's own doc comment for why the KPIs are pure
 * derivations of the same getAllLeaveRequestsAction data this page already
 * fetched, not a second query.
 *
 * No approve/reject/cancel actions live on this page (the old requests
 * table had them; the "currently on leave" table replacing it is a
 * read-only status view) — approveLeaveRequestAction/rejectLeaveRequestAction/
 * cancelLeaveRequestAction still exist in leave-request-actions.ts and work
 * unchanged, they're just not wired to any UI on this specific page today.
 */
export default async function LeavePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Pages.leave")
  const tDashboard = await getTranslations("Leave.dashboard")

  const [requests, leaveTypes] = await Promise.all([getAllLeaveRequestsAction(), getActiveLeaveTypesAction()])
  const leaveTypeById = new Map(leaveTypes.map((leaveType) => [leaveType.id, leaveType]))
  const kpis = computeLeaveDashboardKpis(requests)

  // Single "now" for both filtering (which requests are active today) and
  // the day-count below — the same shared computation the "Hazırda
  // Məzuniyyətdə" KPI (computeLeaveDashboardKpis) and every employee's
  // WorkStatus badge already use, so this table can never disagree with
  // them about who's currently on leave.
  const now = new Date()
  const activeLeaveRequests = Array.from(findActiveLeaveByEmployee(requests, now).values())

  const onLeaveRows: CurrentlyOnLeaveRow[] = await Promise.all(
    activeLeaveRequests.map(async (request) => {
      const profile = await findEmployeeById(request.employeeId)
      const leaveType = leaveTypeById.get(request.leaveTypeId)
      // Same Leave Policy Resolution engine the request wizard's Review
      // step and the old requests table both called — returnDate is the
      // real, holiday/non-working-day-adjusted return-to-work date, never
      // a naive endDate+1.
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
        position: profile?.employment.position ?? "",
        department: profile?.employment.department ?? "",
        leaveTypeName: leaveType?.name ?? request.leaveTypeId,
        startDate: request.startDate.toISOString(),
        endDate: request.endDate.toISOString(),
        returnDate: returnToWork.returnToWorkDate,
        daysUntilReturn: calendarDaysUntil(returnToWork.returnToWorkDate, now),
      }
    })
  )
  // Soonest return first — the employee coming back tomorrow is more
  // actionable for HR than one who just started a month-long leave.
  onLeaveRows.sort((a, b) => a.daysUntilReturn - b.daysUntilReturn)

  // Only employees still on the payroll are assignable from "Yeni
  // Məzuniyyət" — this is a picker-list filter, not a business-logic
  // change (submission validation itself is unchanged). finCode (not
  // department) travels with each option — department is no longer a
  // search field or a displayed hint in the Employee step's picker.
  const employeeOptions = (await findAllEmployees())
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
          <CardTitle>{tDashboard("currentlyOnLeaveTable.title")}</CardTitle>
          <CardDescription>{tDashboard("currentlyOnLeaveTable.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CurrentlyOnLeaveTable rows={onLeaveRows} />
        </CardContent>
      </Card>
    </div>
  )
}
