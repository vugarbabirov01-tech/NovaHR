"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useTranslations } from "next-intl"
import { toPng } from "html-to-image"
import jsPDF from "jspdf"
import { ArrowLeft, ChevronRight, Download, FileImage, Maximize, Minimize, Network, Rows3 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { OrgChartFlowNode, type OrgChartFlowNodeType } from "@/components/organization/org-chart-flow-node"
import { buildAncestorPathsById, findNodeById, flattenOrganizationTree } from "@/lib/organization/build-tree"
import { computeOrganizationChartVisibility } from "@/lib/organization/filter-tree"
import { layoutOrganizationChart } from "@/lib/organization/layout-tree"
import { getFullName } from "@/lib/employees"
import type { OrganizationChartFilters, OrganizationTreeNode } from "@/types/organization"
import type { EmployeeListItem } from "@/types/employee-profile"

// A stable reference, defined once at module scope — React Flow re-renders
// (and warns) if `nodeTypes` is a fresh object every render.
const nodeTypes: NodeTypes = { orgChartNode: OrgChartFlowNode }

// Elements html-to-image should never bake into an export — the zoom
// controls and this panel's own export/fullscreen buttons aren't part of
// the org chart itself.
function isExportableNode(domNode: HTMLElement): boolean {
  return !domNode.classList?.contains("react-flow__controls") &&
    !domNode.classList?.contains("react-flow__panel") &&
    !domNode.classList?.contains("react-flow__attribution")
}

interface OrgChartCanvasProps {
  roots: OrganizationTreeNode[]
  employees: EmployeeListItem[]
  query: string
  filters: OrganizationChartFilters
  exportFileName: string
}

/**
 * Progressive-disclosure redesign: by default only the top leader (this
 * call's own `roots`, normally the one "Baş rəhbər" per company) and their
 * direct reports render — deeper levels stay collapsed until expanded.
 * Clicking "Fokuslan" on any manager (or the "view in focus" action a
 * large-fanout card offers instead of an inline chevron, see
 * layout-tree.ts's INLINE_FANOUT_LIMIT) re-roots the whole canvas at that
 * one manager, so a company's biggest branch never has to share width with
 * everyone else's. A breadcrumb back to "Overview" plus each ancestor in
 * between covers both "exit focus entirely" and "go back one level" with
 * the same control.
 */
function OrgChartCanvasInner({ roots, employees, query, filters, exportFileName }: OrgChartCanvasProps) {
  const t = useTranslations("OrganizationChart")
  const { fitView } = useReactFlow()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(roots.map((root) => root.employee.id))
  )
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const toggle = useCallback((employeeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }, [])

  // Re-roots the canvas at `employeeId` and makes sure its own direct
  // reports show immediately (§9's "fokuslanmış rəhbər və onun birbaşa
  // tabeliyində olanlar mərkəzdə göstərilsin") rather than landing on a
  // focused card that itself still needs an extra click to open.
  const focusOn = useCallback((employeeId: string) => {
    setFocusedId(employeeId)
    setExpandedIds((prev) => new Set(prev).add(employeeId))
  }, [])

  const exitFocus = useCallback((employeeId: string | null) => {
    setFocusedId(employeeId)
  }, [])

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set())
    setFocusedId(null)
  }, [])

  // The company's whole structure, independent of whatever's currently
  // focused/expanded — the breadcrumb and the "does the active search
  // escape the focused branch" check below both need the real shape, not
  // today's rendered slice of it.
  const employeeById = useMemo(() => {
    const map = new Map<string, EmployeeListItem>()
    for (const node of flattenOrganizationTree(roots)) map.set(node.employee.id, node.employee)
    return map
  }, [roots])
  const ancestorPathsById = useMemo(() => buildAncestorPathsById(roots), [roots])

  const focusedNode = focusedId ? findNodeById(roots, focusedId) : null
  // A stale focusedId (reassigned away, deleted, left over from before a
  // data refresh) falls back to the full view instead of an empty canvas.
  useEffect(() => {
    if (focusedId && !focusedNode) setFocusedId(null)
  }, [focusedId, focusedNode])

  const visibility = useMemo(
    () => computeOrganizationChartVisibility(roots, query, filters),
    [roots, query, filters]
  )

  // Search/filter must always be able to reach anyone in the whole
  // company, not just the focused branch — if the active query matches
  // someone outside it, drop back to the full view so their ancestor chain
  // can actually render instead of silently finding nothing.
  useEffect(() => {
    if (!focusedNode || visibility.matchedIds.size === 0) return
    const focusedMemberIds = new Set(
      flattenOrganizationTree([focusedNode]).map((node) => node.employee.id)
    )
    const escapesFocus = Array.from(visibility.matchedIds).some((id) => !focusedMemberIds.has(id))
    if (escapesFocus) setFocusedId(null)
  }, [visibility.matchedIds, focusedNode])

  const layoutRoots = useMemo(() => (focusedNode ? [focusedNode] : roots), [focusedNode, roots])

  const { nodes, edges } = useMemo(() => {
    const layout = layoutOrganizationChart(layoutRoots, expandedIds, visibility)
    const nodes: OrgChartFlowNodeType[] = layout.nodes.map((node) => ({
      ...node,
      data: { ...node.data, employees, onToggle: toggle, onFocus: focusOn },
    }))
    return { nodes, edges: layout.edges }
  }, [layoutRoots, expandedIds, visibility, employees, toggle, focusOn])

  // Recenter on every structural change (focus in/out, expand/collapse),
  // not just on mount — "fokuslanmış rəhbər mərkəzdə göstərilsin" has to
  // hold after every navigation action, and the same padding/maxZoom cap
  // this used to pass to the static `fitView` prop keeps the zoom readable
  // instead of cramming the whole subtree to fit.
  const nodeIdsKey = nodes.map((node) => node.id).join(",")
  useEffect(() => {
    fitView({ padding: 0.3, maxZoom: 1, duration: 200 })
  }, [nodeIdsKey, fitView])

  const breadcrumbAncestors = focusedId
    ? (ancestorPathsById.get(focusedId) ?? [])
        .map((id) => employeeById.get(id))
        .filter((employee): employee is EmployeeListItem => employee !== undefined)
    : []
  const focusedEmployee = focusedNode?.employee ?? null
  const previousLevelId = breadcrumbAncestors.length > 0 ? breadcrumbAncestors[breadcrumbAncestors.length - 1].id : null

  async function toggleFullscreen() {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      setIsFullscreen(false)
    } else {
      await wrapper.requestFullscreen()
      setIsFullscreen(true)
    }
  }

  async function exportPng() {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    setIsExporting(true)
    try {
      const dataUrl = await toPng(wrapper, { filter: isExportableNode, pixelRatio: 2 })
      const link = document.createElement("a")
      link.download = `${exportFileName}.png`
      link.href = dataUrl
      link.click()
    } finally {
      setIsExporting(false)
    }
  }

  async function exportPdf() {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    setIsExporting(true)
    try {
      const dataUrl = await toPng(wrapper, { filter: isExportableNode, pixelRatio: 2 })
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error("image-load-failed"))
        image.src = dataUrl
      })
      const doc = new jsPDF({
        orientation: image.width >= image.height ? "landscape" : "portrait",
        unit: "px",
        format: [image.width, image.height],
      })
      doc.addImage(dataUrl, "PNG", 0, 0, image.width, image.height)
      doc.save(`${exportFileName}.pdf`)
    } finally {
      setIsExporting(false)
    }
  }

  if (roots.length === 0) {
    return <EmptyState icon={Network} title={t("noData")} description={t("noDataDescription")} />
  }

  return (
    <div
      ref={wrapperRef}
      className="h-[70vh] min-h-[480px] w-full overflow-hidden rounded-xl border border-border bg-background"
    >
      {nodes.length === 0 ? (
        <EmptyState icon={Network} title={t("noResults")} description={t("noResultsDescription")} />
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          minZoom={0.3}
          maxZoom={1.5}
          nodesDraggable={false}
          edgesFocusable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls showInteractive={false} />

          {focusedEmployee ? (
            <Panel position="top-left" className="flex max-w-[70%] flex-wrap items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs shadow-sm">
              <Button variant="ghost" size="icon-sm" aria-label={t("backToPreviousLevel")} onClick={() => exitFocus(previousLevelId)}>
                <ArrowLeft className="size-3.5" strokeWidth={1.75} />
              </Button>
              <button type="button" onClick={() => exitFocus(null)} className="text-muted-foreground hover:text-foreground hover:underline">
                {t("overview")}
              </button>
              {breadcrumbAncestors.map((ancestor) => (
                <span key={ancestor.id} className="flex items-center gap-1">
                  <ChevronRight className="size-3 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <button
                    type="button"
                    onClick={() => exitFocus(ancestor.id)}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {getFullName(ancestor)}
                  </button>
                </span>
              ))}
              <span className="flex items-center gap-1">
                <ChevronRight className="size-3 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="font-medium text-foreground">{getFullName(focusedEmployee)}</span>
              </span>
            </Panel>
          ) : null}

          <Panel position="top-right" className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={collapseAll} aria-label={t("collapseAll")}>
              <Rows3 className="size-3.5" strokeWidth={1.75} />
              {t("collapseAll")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportPng}
              disabled={isExporting}
              aria-label={t("exportPng")}
            >
              <FileImage className="size-3.5" strokeWidth={1.75} />
              {t("exportPng")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportPdf}
              disabled={isExporting}
              aria-label={t("exportPdf")}
            >
              <Download className="size-3.5" strokeWidth={1.75} />
              {t("exportPdf")}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
            >
              {isFullscreen ? (
                <Minimize className="size-3.5" strokeWidth={1.75} />
              ) : (
                <Maximize className="size-3.5" strokeWidth={1.75} />
              )}
            </Button>
          </Panel>
        </ReactFlow>
      )}
    </div>
  )
}

/** Wraps the canvas in its own ReactFlowProvider — required for useReactFlow
 * (recentering) and export/fullscreen, and keeps each company-group canvas
 * (organization/organization-view.tsx) fully independent of any sibling
 * one, including its own focus state. */
export function OrgChartCanvas(props: OrgChartCanvasProps) {
  return (
    <ReactFlowProvider>
      <OrgChartCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
