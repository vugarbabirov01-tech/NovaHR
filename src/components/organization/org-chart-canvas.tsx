"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  getNodesBounds,
  getViewportForBounds,
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
import { OrgChartCompanyNode } from "@/components/organization/org-chart-company-node"
import { OrgChartFlowNode, type OrgChartFlowNodeType } from "@/components/organization/org-chart-flow-node"
import { buildAncestorPathsById, findNodeById, flattenOrganizationTree } from "@/lib/organization/build-tree"
import { computeOrganizationChartVisibility } from "@/lib/organization/filter-tree"
import { layoutOrganizationChart, ORG_CHART_LEVEL_PITCH, type OrgChartLayoutNode } from "@/lib/organization/layout-tree"
import { getFullName } from "@/lib/employees"
import type { OrganizationChartFilters, OrganizationTreeNode } from "@/types/organization"
import type { EmployeeListItem } from "@/types/employee-profile"

// A stable reference, defined once at module scope — React Flow re-renders
// (and warns) if `nodeTypes` is a fresh object every render.
const nodeTypes: NodeTypes = { orgChartNode: OrgChartFlowNode, orgChartCompany: OrgChartCompanyNode }

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
  /** Shown on the card that joins several top-level managers; omitted = no company card. */
  companyName?: string
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
function OrgChartCanvasInner({ roots, employees, query, filters, exportFileName, companyName }: OrgChartCanvasProps) {
  const t = useTranslations("OrganizationChart")
  const { fitView, getNodes } = useReactFlow()
  // Under a company card the overview starts with just the top managers, collapsed;
  // without a company name the top managers start open.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => (companyName ? new Set<string>() : new Set(roots.map((root) => root.employee.id)))
  )
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // The card the user just opened/closed: after the layout changes the view
  // moves to it (and its first reports) instead of fitting a possibly very tall
  // column into the screen, which would shrink every card to a speck.
  const pendingFocusId = useRef<string | null>(null)

  const toggle = useCallback((employeeId: string) => {
    pendingFocusId.current = employeeId
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
    // The company card belongs to the full overview, not to a focused branch.
    const company =
      companyName && !focusedNode
        ? {
            label: companyName,
            headcount: roots.reduce((sum, root) => sum + 1 + root.descendantCount, 0),
          }
        : undefined
    const layout = layoutOrganizationChart(layoutRoots, expandedIds, visibility, company)
    const nodes: Array<OrgChartFlowNodeType | OrgChartLayoutNode> = layout.nodes.map((node) =>
      node.type === "orgChartNode"
        ? { ...node, data: { ...node.data, employees, onToggle: toggle, onFocus: focusOn } }
        : node
    )
    return { nodes, edges: layout.edges }
  }, [layoutRoots, expandedIds, visibility, employees, toggle, focusOn, companyName, focusedNode, roots])

  // Recenter on every structural change (focus in/out, expand/collapse),
  // not just on mount — "fokuslanmış rəhbər mərkəzdə göstərilsin" has to
  // hold after every navigation action, and the same padding/maxZoom cap
  // this used to pass to the static `fitView` prop keeps the zoom readable
  // instead of cramming the whole subtree to fit.
  const nodeIdsKey = nodes.map((node) => node.id).join(",")
  useEffect(() => {
    const targetId = pendingFocusId.current
    pendingFocusId.current = null
    if (nodes.length === 0) return

    let ids: string[]
    if (targetId && nodes.some((node) => node.id === targetId)) {
      // The manager sits centred against a (possibly long) column of reports: show the
      // reports closest to it, not the first ones, so the card and its branches stay on screen together.
      const centreY = (id: string) => {
        const node = nodes.find((candidate) => candidate.id === id)
        return node ? node.position.y + Number((node.style as { height?: number } | undefined)?.height ?? 0) / 2 : 0
      }
      const targetY = centreY(targetId)
      const reports = edges
        .filter((edge) => edge.source === targetId)
        .map((edge) => edge.target)
        .sort((x, y) => Math.abs(centreY(x) - targetY) - Math.abs(centreY(y) - targetY))
        .slice(0, 6)
      ids = [targetId, ...reports]
    } else {
      // No specific card: show the first three columns, at most one screen tall.
      const left = Math.min(...nodes.map((node) => node.position.x))
      const top = Math.min(...nodes.map((node) => node.position.y))
      ids = nodes
        .filter((node) => node.position.x - left <= ORG_CHART_LEVEL_PITCH * 2 && node.position.y - top <= 700)
        .map((node) => node.id)
    }
    fitView({ nodes: ids.map((id) => ({ id })), padding: 0.2, minZoom: 0.6, maxZoom: 1, duration: 200 })
    // Only a structural change (nodeIdsKey) recentres; nodes and edges are read as of that change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /**
   * Renders EVERY card currently on the canvas (all opened branches) into one
   * image, however far it extends beyond the screen. The earlier export
   * screenshotted the canvas element, so it only ever contained the slice that
   * happened to be visible. The viewport layer is drawn at 1:1 inside a canvas
   * sized to the nodes' bounds plus a margin.
   */
  async function renderFullChart(): Promise<{ dataUrl: string; width: number; height: number } | null> {
    const wrapper = wrapperRef.current
    const viewportEl = wrapper?.querySelector<HTMLElement>(".react-flow__viewport")
    const allNodes = getNodes()
    if (!wrapper || !viewportEl || allNodes.length === 0) return null

    const margin = 48
    const bounds = getNodesBounds(allNodes)
    const width = Math.ceil(bounds.width + margin * 2)
    const height = Math.ceil(bounds.height + margin * 2)
    const view = getViewportForBounds(bounds, width, height, 0.1, 2, 0)
    // Crisp output, but keep the bitmap inside what browsers can allocate.
    const pixelRatio = Math.max(0.5, Math.min(2, 14000 / Math.max(width, height)))

    const dataUrl = await toPng(viewportEl, {
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      width,
      height,
      pixelRatio,
      filter: isExportableNode,
      style: {
        width: width + "px",
        height: height + "px",
        transform: "translate(" + view.x + "px, " + view.y + "px) scale(" + view.zoom + ")",
      },
    })
    return { dataUrl, width, height }
  }

  async function exportPng() {
    setIsExporting(true)
    try {
      const image = await renderFullChart()
      if (!image) return
      const link = document.createElement("a")
      link.download = exportFileName + ".png"
      link.href = image.dataUrl
      link.click()
    } finally {
      setIsExporting(false)
    }
  }

  async function exportPdf() {
    setIsExporting(true)
    try {
      const image = await renderFullChart()
      if (!image) return
      // The page is exactly the chart's size (in CSS px), so nothing is cropped or scaled.
      const doc = new jsPDF({
        orientation: image.width >= image.height ? "landscape" : "portrait",
        unit: "px",
        format: [image.width, image.height],
        compress: true,
      })
      doc.addImage(image.dataUrl, "PNG", 0, 0, image.width, image.height, undefined, "FAST")
      doc.save(exportFileName + ".pdf")
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
      className="h-[75vh] min-h-[520px] w-full overflow-hidden rounded-xl border border-border bg-background"
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
