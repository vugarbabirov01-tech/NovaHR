"use client"

import { useState } from "react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { useTranslations } from "next-intl"
import { ChevronDown, ChevronRight, Crown, MoreVertical, UserCog } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChangeManagerDialog } from "@/components/organization/change-manager-dialog"
import { setTopExecutiveAction } from "@/app/[locale]/(app)/organization/actions"
import { getFullName, getInitials } from "@/lib/employees"
import { cn } from "@/lib/utils"
import type { OrgChartNodeData } from "@/lib/organization/layout-tree"
import type { EmployeeListItem } from "@/types/employee-profile"

export interface OrgChartFlowNodeFlowData extends OrgChartNodeData {
  employees: EmployeeListItem[]
  onToggle: (employeeId: string) => void
}

export type OrgChartFlowNodeType = Node<OrgChartFlowNodeFlowData, "orgChartNode">

/**
 * The canvas's one employee card — same avatar/name/position convention as
 * every other employee card this session (Payroll's table row, Attendance's
 * board, getFullLegalName for "Soyad Ad Ata adı"). `nodrag`/`nopan` on every
 * interactive child is the React Flow convention that stops a click on a
 * button/link from being swallowed as a canvas pan gesture. Styled through
 * Nova's own CSS variables (bg-card, border-border, ...), not hardcoded
 * colors, so it inherits the app's existing dark-mode tokens for free.
 */
export function OrgChartFlowNode({ data }: NodeProps<OrgChartFlowNodeType>) {
  const t = useTranslations("OrganizationChart")
  const router = useRouter()
  const { node, hasChildren, isExpanded, isMatch, employees, onToggle } = data
  const { employee, children } = node
  const [isChangeManagerOpen, setIsChangeManagerOpen] = useState(false)
  const [isTogglingTopExecutive, setIsTogglingTopExecutive] = useState(false)
  // "Ad Soyad" — same getFullName(employee) OrgChartNode (the List view's
  // own row renderer) already uses for this exact EmployeeListItem shape,
  // which carries no fatherName field — keeping the two views' name format
  // identical, not inventing a different one for the Chart specifically.
  const fullName = getFullName(employee)

  async function handleToggleTopExecutive() {
    setIsTogglingTopExecutive(true)
    await setTopExecutiveAction(employee.id, !employee.isTopExecutive)
    setIsTogglingTopExecutive(false)
    router.refresh()
  }

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm",
        isMatch && "ring-2 ring-primary"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-border" />

      <div className="flex items-start gap-2.5">
        <Link href={`/employees/${employee.id}`} className="nodrag flex min-w-0 flex-1 items-start gap-2.5">
          <Avatar className="shrink-0">
            <AvatarImage src={employee.photoUrl} alt={fullName} />
            <AvatarFallback className="bg-accent text-accent-foreground">
              {getInitials(employee.firstName, employee.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
              {employee.isTopExecutive ? (
                <Crown
                  className="size-3.5 shrink-0 text-amber-500"
                  strokeWidth={1.75}
                  aria-label={t("unassigned.topExecutiveBadge")}
                />
              ) : null}
              <span className="truncate">{fullName}</span>
            </span>
            <span className="truncate text-xs text-muted-foreground">{employee.position}</span>
            <span className="truncate text-[11px] text-muted-foreground/80">{employee.department}</span>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" className="nodrag nopan shrink-0" />}
          >
            <MoreVertical className="size-3.5" strokeWidth={1.75} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsChangeManagerOpen(true)}>
              <UserCog className="size-3.5" strokeWidth={1.75} />
              {t("changeManager.menuLabel")}
            </DropdownMenuItem>
            {!employee.managerId ? (
              <DropdownMenuItem onClick={handleToggleTopExecutive} disabled={isTogglingTopExecutive}>
                <Crown className="size-3.5" strokeWidth={1.75} />
                {employee.isTopExecutive ? t("unassigned.unsetTopExecutive") : t("unassigned.setTopExecutive")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {children.length > 0 ? (
        <Badge
          variant="secondary"
          className="w-fit tabular-nums"
          aria-label={t("directReports", { count: children.length })}
        >
          +{children.length}
        </Badge>
      ) : null}

      {hasChildren ? (
        <button
          type="button"
          onClick={() => onToggle(employee.id)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? t("collapse") : t("expand")}
          className="nodrag nopan absolute -bottom-3 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          {isExpanded ? (
            <ChevronDown className="size-3.5" strokeWidth={2} />
          ) : (
            <ChevronRight className="size-3.5" strokeWidth={2} />
          )}
        </button>
      ) : null}

      <Handle type="source" position={Position.Bottom} className="!bg-border" />

      {isChangeManagerOpen ? (
        <ChangeManagerDialog
          open={isChangeManagerOpen}
          onOpenChange={setIsChangeManagerOpen}
          employee={employee}
          employees={employees}
        />
      ) : null}
    </div>
  )
}
