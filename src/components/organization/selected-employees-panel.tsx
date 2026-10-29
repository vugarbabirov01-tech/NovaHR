"use client"

import { useTranslations } from "next-intl"
import { UserCog, Users, X } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getFullName, getInitials } from "@/lib/employees"
import type { EmployeeListItem } from "@/types/employee-profile"

interface SelectedEmployeesPanelProps {
  /** Already resolved to full employee objects, already limited to the
   * current selection — see UnassignedEmployeesPanel's own doc comment for
   * why this is derived from the full unassigned list, never from whatever
   * the active search happens to be showing right now. */
  employees: EmployeeListItem[]
  onRemove: (employeeId: string) => void
  onClearAll: () => void
  onBulkAssign: () => void
}

/**
 * §6 of the Rəhbər Təyinatı fix — a standing record of every selected
 * employee, independent of the search box above it. Picking someone while
 * searching "Əli", clearing the search, then searching "Vüqar" no longer
 * drops the first pick from view: they stay listed here by name even while
 * the row they came from isn't currently rendered in the (search-narrowed)
 * list below.
 */
export function SelectedEmployeesPanel({ employees, onRemove, onClearAll, onBulkAssign }: SelectedEmployeesPanelProps) {
  const t = useTranslations("OrganizationChart.unassigned")

  if (employees.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" strokeWidth={1.75} />
          {t("selectedPanelTitle")}
          <Badge variant="secondary" className="tabular-nums">
            {employees.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {employees.map((employee) => (
            <span
              key={employee.id}
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pr-1 pl-2 text-xs"
            >
              <Avatar size="sm" className="size-5 shrink-0">
                <AvatarImage src={employee.photoUrl} alt={getFullName(employee)} />
                <AvatarFallback className="bg-accent text-[9px] text-accent-foreground">
                  {getInitials(employee.firstName, employee.lastName)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-foreground">{getFullName(employee)}</span>
              <button
                type="button"
                onClick={() => onRemove(employee.id)}
                aria-label={t("removeFromSelection", { name: getFullName(employee) })}
                className="flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <X className="size-3" strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBulkAssign}>
            <UserCog className="size-3.5" strokeWidth={1.75} />
            {t("bulkAssign")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            {t("clearSelection")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
