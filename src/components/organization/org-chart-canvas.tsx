"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useTranslations } from "next-intl"
import { toPng } from "html-to-image"
import jsPDF from "jspdf"
import { Download, FileImage, Maximize, Minimize, Network } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { OrgChartFlowNode, type OrgChartFlowNodeType } from "@/components/organization/org-chart-flow-node"
import { computeOrganizationChartVisibility } from "@/lib/organization/filter-tree"
import { layoutOrganizationChart } from "@/lib/organization/layout-tree"
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

function OrgChartCanvasInner({ roots, employees, query, filters, exportFileName }: OrgChartCanvasProps) {
  const t = useTranslations("OrganizationChart")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
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

  const visibility = useMemo(
    () => computeOrganizationChartVisibility(roots, query, filters),
    [roots, query, filters]
  )

  const { nodes, edges } = useMemo(() => {
    const layout = layoutOrganizationChart(roots, expandedIds, visibility)
    const nodes: OrgChartFlowNodeType[] = layout.nodes.map((node) => ({
      ...node,
      data: { ...node.data, employees, onToggle: toggle },
    }))
    return { nodes, edges: layout.edges }
  }, [roots, expandedIds, visibility, employees, toggle])

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
  if (nodes.length === 0) {
    return <EmptyState icon={Network} title={t("noResults")} description={t("noResultsDescription")} />
  }

  return (
    <div
      ref={wrapperRef}
      className="h-[70vh] min-h-[480px] w-full overflow-hidden rounded-xl border border-border bg-background"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
        <Panel position="top-right" className="flex items-center gap-1.5">
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
    </div>
  )
}

/** Wraps the canvas in its own ReactFlowProvider — required whenever a
 * component inside the tree (export, fullscreen) needs the flow instance's
 * own context, and keeps each company-group canvas (organization/
 * organization-view.tsx) fully independent of any sibling one. */
export function OrgChartCanvas(props: OrgChartCanvasProps) {
  return (
    <ReactFlowProvider>
      <OrgChartCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
