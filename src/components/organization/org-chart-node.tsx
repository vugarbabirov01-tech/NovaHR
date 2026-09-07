"use client"

import { ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { getFullName, getInitials } from "@/lib/employees"
import type { OrganizationTreeNode } from "@/types/organization"

export interface OrgChartVisibility {
  /** null = normal expand/collapse rules (no active search/filter). Set =
   * only these ids render at all — everything else is pruned, per Search/
   * Filter's "don't break the hierarchy, just narrow it" requirement. */
  visibleIds: Set<string> | null
  /** Ancestors of a search/filter match — expanded regardless of the
   * user's own manual expandedIds, so the match is reachable. */
  forceExpandIds: Set<string>
  /** Nodes that directly match the current search/filter — highlighted. */
  matchedIds: Set<string>
}

interface OrgChartNodeProps {
  node: OrganizationTreeNode
  expandedIds: Set<string>
  onToggle: (employeeId: string) => void
  visibility: OrgChartVisibility
  /** Full Chart uses a slightly larger/roomier row; the compact page view
   * and the mobile layout use this tighter one. Same component either way
   * — only spacing/avatar size change, never the data or interaction. */
  density?: "compact" | "comfortable"
}

/**
 * One employee row plus, if expanded, its children — recursively. The only
 * place an Organization Chart row is ever rendered; the compact page view
 * and the Full Chart dialog both call this, so they can never visually
 * drift apart. Connector lines are plain CSS (a left guide line + a short
 * horizontal stub per child) — deliberately not SVG/canvas, since a plain
 * DOM tree is what lets this reuse Avatar/Badge/Link directly instead of
 * re-drawing them inside a graph library's node renderer.
 */
export function OrgChartNode({ node, expandedIds, onToggle, visibility, density = "comfortable" }: OrgChartNodeProps) {
  const t = useTranslations("OrganizationChart")
  const { employee, children, descendantCount } = node
  const hasChildren = children.length > 0
  const isExpanded = hasChildren && (expandedIds.has(employee.id) || visibility.forceExpandIds.has(employee.id))
  const isMatch = visibility.matchedIds.has(employee.id)
  const isCompact = density === "compact"

  const visibleChildren = children.filter(
    (child) => visibility.visibleIds === null || visibility.visibleIds.has(child.employee.id)
  )

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "group flex items-center gap-2 rounded-lg",
          isCompact ? "py-1" : "py-1.5",
          isMatch && "bg-primary/5 ring-1 ring-primary/30"
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(employee.id)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? t("collapse") : t("expand")}
            className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronRight
              className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")}
              strokeWidth={2}
            />
          </button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden />
        )}

        <Link
          href={`/employees/${employee.id}`}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Avatar size={isCompact ? "sm" : "default"} className="shrink-0">
            <AvatarImage src={employee.photoUrl} alt={getFullName(employee)} />
            <AvatarFallback className="bg-accent text-accent-foreground">
              {getInitials(employee.firstName, employee.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground">{getFullName(employee)}</span>
            <span className="truncate text-xs text-muted-foreground">{employee.position}</span>
          </div>
          {descendantCount > 0 ? (
            <Badge variant="secondary" className="ml-auto shrink-0 tabular-nums">
              {descendantCount}
            </Badge>
          ) : null}
        </Link>
      </div>

      {isExpanded && visibleChildren.length > 0 ? (
        <div className="flex flex-col">
          {visibleChildren.map((child, index) => (
            <div key={child.employee.id} className="relative pl-6">
              <span
                aria-hidden
                className={cn(
                  "absolute top-0 left-[9px] w-px bg-border",
                  index === visibleChildren.length - 1 ? "h-4" : "h-full"
                )}
              />
              <span
                aria-hidden
                className={cn("absolute left-[9px] h-px w-3 bg-border", isCompact ? "top-4" : "top-5")}
              />
              <OrgChartNode
                node={child}
                expandedIds={expandedIds}
                onToggle={onToggle}
                visibility={visibility}
                density={density}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
