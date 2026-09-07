"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Maximize, Minus, Network, Plus, Rows3, Rows4 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/common/search-input"
import { EmptyState } from "@/components/common/empty-state"
import { OrgChartNode } from "@/components/organization/org-chart-node"
import { OrgChartFilters } from "@/components/organization/org-chart-filters"
import { flattenOrganizationTree } from "@/lib/organization/build-tree"
import { computeOrganizationChartVisibility } from "@/lib/organization/filter-tree"
import type { OrganizationTreeNode, OrganizationChartFilters } from "@/types/organization"
import type { EmployeeListItem } from "@/types/employee-profile"

const MIN_SCALE = 0.3
const MAX_SCALE = 2
const SCALE_STEP = 0.15

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

interface FullChartDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tree: OrganizationTreeNode[]
  employees: EmployeeListItem[]
  managerNames: string[]
  /** Seeded from the compact view's own state the moment this opens, then
   * managed independently — so drilling into a branch on the compact page
   * carries over here, but "Expand All"/a search typed inside the dialog
   * never mutates the compact view still sitting behind it. Same "re-derive
   * from props only on open" pattern ExportEmployeesDialog already uses. */
  initialExpandedIds: Set<string>
  initialQuery: string
  initialFilters: OrganizationChartFilters
}

/**
 * §6 — Full Chart: the same OrgChartNode tree as the compact page view,
 * inside a pan/zoom viewport instead of a plain scroll container. No graph
 * library — a11y and Card/Avatar/Badge reuse both depend on this still
 * being plain DOM, so pan/zoom is a CSS transform on that DOM plus pointer/
 * wheel handlers, not a canvas re-render.
 */
export function FullChartDialog({
  open,
  onOpenChange,
  tree,
  employees,
  managerNames,
  initialExpandedIds,
  initialQuery,
  initialFilters,
}: FullChartDialogProps) {
  const t = useTranslations("OrganizationChart")
  const [expandedIds, setExpandedIds] = useState(initialExpandedIds)
  const [query, setQuery] = useState(initialQuery)
  const [filters, setFilters] = useState(initialFilters)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 24, y: 24 })
  const [isPanning, setIsPanning] = useState(false)

  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const panState = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(
    null
  )

  // Re-derive from the compact view's current state only the instant this
  // opens — afterward this dialog's own interactions (zoom, pan, expand
  // all, its own search) are fully independent of it.
  useEffect(() => {
    if (!open) return
    setExpandedIds(new Set(initialExpandedIds))
    setQuery(initialQuery)
    setFilters(initialFilters)
    setScale(1)
    setTranslate({ x: 24, y: 24 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Wheel-to-zoom, anchored on the cursor — attached as a non-passive
  // native listener (not JSX onWheel) because browsers mark React's own
  // wheel handler passive by default, which silently ignores
  // preventDefault and lets the page scroll underneath the chart instead
  // of zooming it.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !open) return

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      const rect = viewport!.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      setScale((prevScale) => {
        const nextScale = clampScale(prevScale * (1 - event.deltaY * 0.001))
        const ratio = nextScale / prevScale
        setTranslate((prevTranslate) => ({
          x: pointerX - (pointerX - prevTranslate.x) * ratio,
          y: pointerY - (pointerY - prevTranslate.y) * ratio,
        }))
        return nextScale
      })
    }

    viewport.addEventListener("wheel", handleWheel, { passive: false })
    return () => viewport.removeEventListener("wheel", handleWheel)
  }, [open])

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Ignore clicks on interactive descendants (node links/expand buttons)
    // — only dragging the empty canvas should pan.
    if ((event.target as HTMLElement).closest("a,button")) return
    panState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: translate.x,
      originY: translate.y,
    }
    setIsPanning(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const pan = panState.current
    if (!pan || pan.pointerId !== event.pointerId) return
    setTranslate({
      x: pan.originX + (event.clientX - pan.startX),
      y: pan.originY + (event.clientY - pan.startY),
    })
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (panState.current?.pointerId === event.pointerId) {
      panState.current = null
      setIsPanning(false)
    }
  }

  function zoomBy(factor: number) {
    setScale((prev) => clampScale(prev + factor))
  }

  function fitToScreen() {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return
    // Measure the tree at its natural (unscaled) size — divide out any
    // scale already applied so this is accurate however zoomed-in we are.
    const naturalWidth = content.scrollWidth / scale
    const naturalHeight = content.scrollHeight / scale
    if (naturalWidth === 0 || naturalHeight === 0) return
    const viewportRect = viewport.getBoundingClientRect()
    const padding = 48
    const nextScale = clampScale(
      Math.min((viewportRect.width - padding) / naturalWidth, (viewportRect.height - padding) / naturalHeight)
    )
    setScale(nextScale)
    setTranslate({
      x: (viewportRect.width - naturalWidth * nextScale) / 2,
      y: padding / 2,
    })
  }

  function expandAll() {
    const ids = flattenOrganizationTree(tree)
      .filter((node) => node.children.length > 0)
      .map((node) => node.employee.id)
    setExpandedIds(new Set(ids))
  }

  function collapseAll() {
    setExpandedIds(new Set())
  }

  const visibility = useMemo(() => computeOrganizationChartVisibility(tree, query, filters), [tree, query, filters])
  const visibleRoots = tree.filter(
    (node) => visibility.visibleIds === null || visibility.visibleIds.has(node.employee.id)
  )

  function toggle(employeeId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="top-0 right-0 bottom-0 left-0 flex h-full max-h-full w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:h-[90vh] sm:max-h-[90vh] sm:w-[95vw] sm:max-w-[95vw] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl lg:w-[90vw] lg:max-w-[90vw]"
      >
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12">
          <DialogTitle>{t("fullChart")}</DialogTitle>
          <DialogDescription>{t("fullChartDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-6 py-3">
          <SearchInput
            placeholder={t("searchPlaceholder")}
            containerClassName="w-full sm:max-w-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <OrgChartFilters employees={employees} managerNames={managerNames} filters={filters} onChange={setFilters} />

          <div className="ml-auto flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={expandAll}>
              <Rows4 className="size-3.5" strokeWidth={1.75} />
              {t("expandAll")}
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              <Rows3 className="size-3.5" strokeWidth={1.75} />
              {t("collapseAll")}
            </Button>
            <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
            <Button variant="outline" size="icon-sm" aria-label={t("zoomOut")} onClick={() => zoomBy(-SCALE_STEP)}>
              <Minus className="size-3.5" strokeWidth={1.75} />
            </Button>
            <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
            <Button variant="outline" size="icon-sm" aria-label={t("zoomIn")} onClick={() => zoomBy(SCALE_STEP)}>
              <Plus className="size-3.5" strokeWidth={1.75} />
            </Button>
            <Button variant="outline" size="sm" onClick={fitToScreen}>
              <Maximize className="size-3.5" strokeWidth={1.75} />
              {t("fitToScreen")}
            </Button>
          </div>
        </div>

        {tree.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState icon={Network} title={t("noData")} description={t("noDataDescription")} />
          </div>
        ) : visibleRoots.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState icon={Network} title={t("noResults")} description={t("noResultsDescription")} />
          </div>
        ) : (
          <div
            ref={viewportRef}
            className="relative flex-1 touch-none overflow-hidden bg-muted/20 select-none"
            style={{ cursor: isPanning ? "grabbing" : "grab" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div
              ref={contentRef}
              className="absolute top-0 left-0 flex flex-col gap-1 p-6"
              style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`, transformOrigin: "0 0" }}
            >
              {visibleRoots.map((node) => (
                <OrgChartNode
                  key={node.employee.id}
                  node={node}
                  expandedIds={expandedIds}
                  onToggle={toggle}
                  visibility={visibility}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
