"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { CheckCircle2, Crown, UserCog, Users } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/common/empty-state"
import { ChangeManagerDialog } from "@/components/organization/change-manager-dialog"
import { BulkAssignManagerDialog } from "@/components/organization/bulk-assign-manager-dialog"
import { SelectedEmployeesPanel } from "@/components/organization/selected-employees-panel"
import { setTopExecutiveAction } from "@/app/[locale]/(app)/organization/actions"
import { useRouter } from "@/i18n/navigation"
import { employeeMatches } from "@/lib/organization/filter-tree"
import { getFullName, getInitials } from "@/lib/employees"
import type { OrganizationChartFilters } from "@/types/organization"
import type { EmployeeListItem } from "@/types/employee-profile"

interface UnassignedEmployeesPanelProps {
  /** Roots with no manager AND no one reporting to them, and not designated
   * isTopExecutive (split-unassigned.ts) — standalone employees the chart
   * above never shows as a "root". */
  employees: EmployeeListItem[]
  /** The full roster, for ChangeManagerDialog/BulkAssignManagerDialog's own
   * manager candidate lists. */
  allEmployees: EmployeeListItem[]
  query: string
  filters: OrganizationChartFilters
}

/**
 * §5 — a dedicated, searchable, multi-select home for employees with no
 * recorded manager, instead of rendering them as 100+ one-card "roots"
 * flattening the chart into a single row (see split-unassigned.ts for why
 * that happened). Reuses the exact same employeeMatches predicate Search/
 * Filter already use everywhere else, so typing the same thing here and in
 * the chart's own search box narrows the same way.
 *
 * Selection is kept as a plain Set<employeeId> (`selectedIds`) and is NEVER
 * reset by query/filter changes — the only two things that remove an id
 * from it are the user explicitly deselecting it, and a successful bulk
 * assignment carrying it away. Every DERIVED view of "what's selected"
 * (the count, the dedicated SelectedEmployeesPanel below, the employees
 * handed to BulkAssignManagerDialog) is resolved from `employees` — the
 * full unassigned roster this panel received — not from `visible` (the
 * search/filter-narrowed subset actually rendered as rows). That distinction
 * is the fix: the previous version derived all of those from `visible`,
 * which meant picking someone, then typing a different search that no
 * longer matched them, silently dropped them from every one of those views
 * even though `selectedIds` itself still had their id — "seçim itdi" from
 * the user's side, even though the underlying state never actually lost it.
 * Re-deriving from `employees` on every render also satisfies "re-verify
 * the selection is still valid before bulk-assigning" for free: an id that
 * stops being unassigned (someone else assigned them a manager, or they
 * left this list for any other reason) naturally falls out of `employees`
 * on the next data refresh, and so falls out of every derived view too.
 *
 * §12/§13 — the header count is "active employees still needing a manager"
 * (employmentStatus === "active", matching the spec's own "bütün aktiv
 * əməkdaşların" wording exactly) — inactive/terminated orphans still show
 * in the list below so nothing's hidden, they just don't count toward
 * "remaining" or block the completed state. When that count reaches zero,
 * the header switches to a completed badge instead of a number.
 */
export function UnassignedEmployeesPanel({ employees, allEmployees, query, filters }: UnassignedEmployeesPanelProps) {
  const t = useTranslations("OrganizationChart")
  const router = useRouter()
  const [assigningEmployee, setAssigningEmployee] = useState<EmployeeListItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [pendingTopExecutiveId, setPendingTopExecutiveId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return employees.filter((employee) => employeeMatches(employee, normalizedQuery, filters))
  }, [employees, query, filters])

  const remainingActiveCount = useMemo(
    () => employees.filter((employee) => employee.employmentStatus === "active").length,
    [employees]
  )
  const isCompleted = remainingActiveCount === 0

  // Resolved from the FULL unassigned list, not `visible` — see the
  // component doc comment above for why this is the actual fix.
  const selectedEmployeeObjects = useMemo(
    () => employees.filter((employee) => selectedIds.has(employee.id)),
    [employees, selectedIds]
  )
  const allVisibleSelected = visible.length > 0 && visible.every((employee) => selectedIds.has(employee.id))
  const someVisibleSelected = visible.some((employee) => selectedIds.has(employee.id))

  function toggleOne(employeeId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(employeeId)
      else next.delete(employeeId)
      return next
    })
  }

  // Scoped to `visible` on purpose — "select all" only ever touches the
  // rows the current search/filter actually shows, and never removes an
  // earlier pick that isn't part of this filtered set.
  function toggleAllVisible(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const employee of visible) {
        if (checked) next.add(employee.id)
        else next.delete(employee.id)
      }
      return next
    })
  }

  function removeFromSelection(employeeId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(employeeId)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function handleSetTopExecutive(employee: EmployeeListItem) {
    setPendingTopExecutiveId(employee.id)
    await setTopExecutiveAction(employee.id, true)
    setPendingTopExecutiveId(null)
    router.refresh()
  }

  if (employees.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <SelectedEmployeesPanel
        employees={selectedEmployeeObjects}
        onRemove={removeFromSelection}
        onClearAll={clearSelection}
        onBulkAssign={() => setIsBulkDialogOpen(true)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" strokeWidth={1.75} />
            {t("unassigned.title")}
            {isCompleted ? (
              <Badge variant="secondary" className="gap-1 text-status-good">
                <CheckCircle2 className="size-3.5" strokeWidth={1.75} />
                {t("unassigned.completed")}
              </Badge>
            ) : (
              <Badge variant="secondary" className="tabular-nums" aria-label={t("unassigned.remaining")}>
                {remainingActiveCount}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {visible.length === 0 ? (
            <EmptyState icon={Users} title={t("noResults")} description={t("noResultsDescription")} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected && !allVisibleSelected}
                  onCheckedChange={(checked) => toggleAllVisible(checked === true)}
                  aria-label={t("unassigned.selectAll")}
                />
                <span className="text-xs text-muted-foreground">{t("unassigned.selectAll")}</span>
              </div>

              <div className="flex max-h-[400px] flex-col divide-y divide-border overflow-y-auto">
                {visible.map((employee) => (
                  <div key={employee.id} className="flex items-center gap-2.5 py-2">
                    <Checkbox
                      checked={selectedIds.has(employee.id)}
                      onCheckedChange={(checked) => toggleOne(employee.id, checked === true)}
                      aria-label={getFullName(employee)}
                    />
                    <Avatar size="sm" className="shrink-0">
                      <AvatarImage src={employee.photoUrl} alt={getFullName(employee)} />
                      <AvatarFallback className="bg-accent text-accent-foreground">
                        {getInitials(employee.firstName, employee.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">{getFullName(employee)}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {employee.position} · {employee.department}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      disabled={pendingTopExecutiveId === employee.id}
                      onClick={() => handleSetTopExecutive(employee)}
                    >
                      <Crown className="size-3.5" strokeWidth={1.75} />
                      {t("unassigned.setTopExecutive")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setAssigningEmployee(employee)}
                    >
                      <UserCog className="size-3.5" strokeWidth={1.75} />
                      {t("unassigned.assign")}
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>

        {assigningEmployee ? (
          <ChangeManagerDialog
            open={Boolean(assigningEmployee)}
            onOpenChange={(open) => {
              if (!open) setAssigningEmployee(null)
            }}
            employee={assigningEmployee}
            employees={allEmployees}
          />
        ) : null}

        <BulkAssignManagerDialog
          open={isBulkDialogOpen}
          onOpenChange={setIsBulkDialogOpen}
          employees={selectedEmployeeObjects}
          allEmployees={allEmployees}
          onAssigned={clearSelection}
        />
      </Card>
    </div>
  )
}
