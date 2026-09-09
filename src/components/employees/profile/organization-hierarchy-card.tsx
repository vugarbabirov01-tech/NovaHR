"use client"

import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { getFullName, getInitials } from "@/lib/employees"
import { cn } from "@/lib/utils"
import type { OrganizationTreeNode } from "@/types/organization"

interface OrganizationHierarchyCardProps {
  /** Root-to-employee reporting chain, already built server-side by
   * buildManagerChain (src/lib/organization/build-tree.ts) — this
   * component only renders it, never resolves managerId itself. Empty
   * only when the employee's own id couldn't be resolved (defensive; the
   * profile page that renders this always has a real employee). */
  chain: OrganizationTreeNode[]
  currentEmployeeId: string
}

/**
 * A linear special case of the same reporting data OrgChartNode renders as
 * a branching tree (src/components/organization/org-chart-node.tsx) — the
 * connector line here is the exact "circle + flex-1 vertical bar" technique
 * src/components/common/timeline.tsx already uses for Employment History,
 * just with a real employee Avatar in the circle's place instead of a
 * Lucide icon, since Timeline's icon slot is typed to LucideIcon only.
 */
export function OrganizationHierarchyCard({ chain, currentEmployeeId }: OrganizationHierarchyCardProps) {
  const t = useTranslations("Employees.profile.overview")
  const tOrgChart = useTranslations("OrganizationChart")

  if (chain.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("organizationHierarchy")}</CardTitle>
        <CardAction>
          <Link
            href="/organization"
            className="text-xs font-medium text-primary outline-none hover:underline focus-visible:underline"
          >
            {tOrgChart("fullChart")}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ol className="flex max-h-96 flex-col overflow-y-auto">
          {chain.map((node, index) => {
            const { employee, descendantCount } = node
            const isCurrent = employee.id === currentEmployeeId
            const isLast = index === chain.length - 1
            const fullName = getFullName(employee)

            const content = (
              <div
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1",
                  isCurrent && "bg-accent/60 ring-1 ring-border"
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{fullName}</span>
                  <span className="truncate text-xs text-muted-foreground">{employee.position}</span>
                </div>
                {isCurrent ? (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {t("currentEmployeeBadge")}
                  </Badge>
                ) : descendantCount > 0 ? (
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {descendantCount}
                  </Badge>
                ) : null}
              </div>
            )

            return (
              <li key={employee.id} className="flex gap-2.5">
                <div className="flex flex-col items-center">
                  <Avatar size="sm" className="shrink-0">
                    <AvatarImage src={employee.photoUrl} alt={fullName} />
                    <AvatarFallback className="bg-accent text-accent-foreground">
                      {getInitials(employee.firstName, employee.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  {!isLast ? <span className="w-px flex-1 bg-border" /> : null}
                </div>
                <div className={cn("flex min-w-0 flex-1 items-center", !isLast && "pb-3")}>
                  {isCurrent ? (
                    content
                  ) : (
                    <Link
                      href={`/employees/${employee.id}`}
                      className="flex min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {content}
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
