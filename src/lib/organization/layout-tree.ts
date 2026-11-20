import type { Edge, Node } from "@xyflow/react"

import type { OrganizationChartVisibilityResult } from "@/lib/organization/filter-tree"
import type { OrganizationTreeNode } from "@/types/organization"

export const ORG_CHART_NODE_WIDTH = 264
/** A card that has reports (shows the direct/total report badges). */
export const ORG_CHART_NODE_HEIGHT = 132
/** A card without reports: just avatar, name and position. */
export const ORG_CHART_LEAF_HEIGHT = 72
export const ORG_CHART_COMPANY_NODE_HEIGHT = 64
export const ORG_CHART_COMPANY_NODE_ID = "__company__"

/** Vertical gap between a manager and the row of reports below (the connector runs through it). */
export const ORG_CHART_LEVEL_GAP = 56
/** Horizontal gap between two siblings in a row. */
export const ORG_CHART_SIBLING_GAP = 24
/** Vertical gap between the rows of a grid of reports (room for the connector and the expand button). */
export const ORG_CHART_GRID_ROW_GAP = 40
/** A manager with up to this many reports spreads them in one row below; more reports are
 * wrapped into a grid of ORG_CHART_GRID_COLUMNS per row so the chart stays neither extremely
 * wide nor extremely tall. */
export const ORG_CHART_ROW_LIMIT = 5
export const ORG_CHART_GRID_COLUMNS = 4

/** A manager with more direct reports than this never expands inline — the
 * card offers "view in focus" instead of a chevron. It only protects against
 * a runaway list. Never applies to a call's own top-level roots (depth 0). */
export const INLINE_FANOUT_LIMIT = 40

export interface OrgChartNodeData extends Record<string, unknown> {
  node: OrganizationTreeNode
  hasChildren: boolean
  isExpanded: boolean
  isMatch: boolean
  /** True once this node's OWN direct-child count passes INLINE_FANOUT_LIMIT. */
  exceedsInlineFanout: boolean
}

/** The synthetic card on top that the top-level managers branch from. */
export interface OrgChartCompanyData extends Record<string, unknown> {
  label: string
  headcount: number
}

export interface OrgChartCompanyRoot {
  label: string
  headcount: number
}

export type OrgChartLayoutNode = Node<OrgChartNodeData, "orgChartNode"> | Node<OrgChartCompanyData, "orgChartCompany">

interface Item {
  id: string
  height: number
  kind: "employee" | "company" | "virtual"
  data: OrgChartNodeData | OrgChartCompanyData
  children: Item[]
}

interface Block {
  item: Item
  kids: Block[]
  /** "row": reports side by side below; "grid": reports wrapped into rows; "none": no visible reports. */
  mode: "row" | "grid" | "none"
  /** Width / height of this card's whole branch, reports included. */
  width: number
  height: number
  /** Grid only: reports split into rows, and each column's / row's size. */
  gridRows?: Block[][]
  colWidths?: number[]
  rowHeights?: number[]
}

/** The company card and the invisible root always use a single row. */
function measure(item: Item): Block {
  const isVirtual = item.kind === "virtual"
  const cardWidth = isVirtual ? 0 : ORG_CHART_NODE_WIDTH
  if (item.children.length === 0) return { item, kids: [], mode: "none", width: cardWidth, height: item.height }

  const kids = item.children.map(measure)
  const levelGap = isVirtual ? 0 : ORG_CHART_LEVEL_GAP

  if (item.kind === "employee" && kids.length > ORG_CHART_ROW_LIMIT) {
    const gridRows: Block[][] = []
    for (let i = 0; i < kids.length; i += ORG_CHART_GRID_COLUMNS) gridRows.push(kids.slice(i, i + ORG_CHART_GRID_COLUMNS))
    const colWidths = Array.from({ length: ORG_CHART_GRID_COLUMNS }, (_, c) =>
      Math.max(0, ...gridRows.map((row) => row[c]?.width ?? 0))
    ).filter((w) => w > 0)
    const rowHeights = gridRows.map((row) => Math.max(...row.map((kid) => kid.height)))
    const gridWidth = colWidths.reduce((sum, w) => sum + w, 0) + ORG_CHART_SIBLING_GAP * (colWidths.length - 1)
    const gridHeight = rowHeights.reduce((sum, h) => sum + h, 0) + ORG_CHART_GRID_ROW_GAP * (rowHeights.length - 1)
    return {
      item,
      kids,
      mode: "grid",
      width: Math.max(cardWidth, gridWidth),
      height: item.height + levelGap + gridHeight,
      gridRows,
      colWidths,
      rowHeights,
    }
  }

  const rowWidth = kids.reduce((sum, kid) => sum + kid.width, 0) + ORG_CHART_SIBLING_GAP * (kids.length - 1)
  return {
    item,
    kids,
    mode: "row",
    width: Math.max(cardWidth, rowWidth),
    height: item.height + levelGap + Math.max(...kids.map((kid) => kid.height)),
  }
}

/**
 * Converts one company's top-level OrganizationTreeNode[] into React Flow
 * nodes/edges as a top-down tree. A manager with up to ORG_CHART_ROW_LIMIT
 * reports spreads them in one row below, centred under the manager; a manager
 * with more reports wraps them into a grid (ORG_CHART_GRID_COLUMNS per row), so
 * a 25-person team is a compact block rather than 7000px wide or one endless column.
 *
 * A node's children are only walked into the graph when expandedIds has it
 * (or visibility.forceExpandIds does — a search/filter match's ancestors
 * auto-expand regardless of manual state) AND visibility allows it. When a
 * `company` is given, a synthetic card sits on top and the roots branch from
 * it (also for a single root, so the company name is always visible).
 */
export function layoutOrganizationChart(
  roots: OrganizationTreeNode[],
  expandedIds: Set<string>,
  visibility: OrganizationChartVisibilityResult,
  company?: OrgChartCompanyRoot
): { nodes: OrgChartLayoutNode[]; edges: Edge[] } {
  function build(node: OrganizationTreeNode, depth: number): Item | null {
    if (visibility.visibleIds && !visibility.visibleIds.has(node.employee.id)) return null

    const hasChildren = node.children.length > 0
    const exceedsInlineFanout = depth > 0 && node.children.length > INLINE_FANOUT_LIMIT
    const isExpanded =
      hasChildren &&
      (visibility.forceExpandIds.has(node.employee.id) ||
        (!exceedsInlineFanout && expandedIds.has(node.employee.id)))
    const isMatch = visibility.matchedIds.has(node.employee.id)

    const children: Item[] = []
    if (isExpanded) {
      for (const child of node.children) {
        const built = build(child, depth + 1)
        if (built) children.push(built)
      }
    }
    return {
      id: node.employee.id,
      height: hasChildren ? ORG_CHART_NODE_HEIGHT : ORG_CHART_LEAF_HEIGHT,
      kind: "employee",
      data: { node, hasChildren, isExpanded, isMatch, exceedsInlineFanout },
      children,
    }
  }

  const rootItems = roots.map((root) => build(root, 0)).filter((item): item is Item => item !== null)
  if (rootItems.length === 0) return { nodes: [], edges: [] }

  const top: Item = company
    ? {
        id: ORG_CHART_COMPANY_NODE_ID,
        height: ORG_CHART_COMPANY_NODE_HEIGHT,
        kind: "company",
        data: { label: company.label, headcount: company.headcount },
        children: rootItems,
      }
    : rootItems.length === 1
      ? rootItems[0]
      : // Several roots and no company card: lay them side by side under an invisible parent.
        { id: "__virtual__", height: 0, kind: "virtual", data: { label: "", headcount: 0 }, children: rootItems }

  const nodes: OrgChartLayoutNode[] = []
  const edges: Edge[] = []

  function place(block: Block, x: number, y: number, parent: Item | null, inGrid: boolean) {
    const { item } = block
    const isVirtual = item.kind === "virtual"
    const cardX = x + (block.width - ORG_CHART_NODE_WIDTH) / 2

    if (!isVirtual) {
      if (item.kind === "company") {
        nodes.push({
          id: item.id,
          type: "orgChartCompany",
          position: { x: cardX, y },
          style: { width: ORG_CHART_NODE_WIDTH, height: item.height },
          data: item.data as OrgChartCompanyData,
          draggable: false,
          connectable: false,
        })
      } else {
        nodes.push({
          id: item.id,
          type: "orgChartNode",
          position: { x: cardX, y },
          style: { width: ORG_CHART_NODE_WIDTH, height: item.height },
          data: item.data as OrgChartNodeData,
          draggable: false,
          connectable: false,
        })
      }
    }

    if (parent && parent.kind !== "virtual") {
      const edge: Edge & { pathOptions?: { stepPosition: number } } = {
        id: `${parent.id}->${item.id}`,
        source: parent.id,
        target: item.id,
        type: "smoothstep",
      }
      // Reports in a grid all branch off one bus line just below the manager, then drop straight down.
      if (inGrid) edge.pathOptions = { stepPosition: 0 }
      edges.push(edge)
    }

    if (block.mode === "none") return
    const childY = y + item.height + (isVirtual ? 0 : ORG_CHART_LEVEL_GAP)

    if (block.mode === "grid" && block.gridRows && block.colWidths && block.rowHeights) {
      const gridWidth =
        block.colWidths.reduce((sum, w) => sum + w, 0) + ORG_CHART_SIBLING_GAP * (block.colWidths.length - 1)
      const gridX = x + (block.width - gridWidth) / 2
      let rowY = childY
      block.gridRows.forEach((row, r) => {
        let colX = gridX
        row.forEach((kid, c) => {
          place(kid, colX + (block.colWidths![c] - kid.width) / 2, rowY, item, true)
          colX += block.colWidths![c] + ORG_CHART_SIBLING_GAP
        })
        rowY += block.rowHeights![r] + ORG_CHART_GRID_ROW_GAP
      })
      return
    }

    const rowWidth =
      block.kids.reduce((sum, kid) => sum + kid.width, 0) + ORG_CHART_SIBLING_GAP * (block.kids.length - 1)
    let cursorX = x + (block.width - rowWidth) / 2
    for (const kid of block.kids) {
      place(kid, cursorX, childY, item, false)
      cursorX += kid.width + ORG_CHART_SIBLING_GAP
    }
  }

  place(measure(top), 0, 0, null, false)
  return { nodes, edges }
}
