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

/** Gap between a level and the next one (the connector runs through it). */
export const ORG_CHART_LEVEL_GAP = 64
/** Horizontal distance between two levels' left edges. */
export const ORG_CHART_LEVEL_PITCH = ORG_CHART_NODE_WIDTH + ORG_CHART_LEVEL_GAP
/** Vertical gap between stacked siblings. */
const SIBLING_GAP = 16

/** A manager with more direct reports than this never expands inline — the
 * card offers "view in focus" instead of a chevron. It only protects against
 * a runaway list: the tree grows sideways, so a normal team is fine. Never
 * applies to a call's own top-level roots (depth 0). */
export const INLINE_FANOUT_LIMIT = 40

export interface OrgChartNodeData extends Record<string, unknown> {
  node: OrganizationTreeNode
  hasChildren: boolean
  isExpanded: boolean
  isMatch: boolean
  /** True once this node's OWN direct-child count passes INLINE_FANOUT_LIMIT. */
  exceedsInlineFanout: boolean
}

/** The synthetic card on the left that the top-level managers branch from. */
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
  /** Height of this card's whole branch: the taller of the card itself and its stacked children. */
  height: number
}

function measure(item: Item): Block {
  const kids = item.children.map(measure)
  const stacked = kids.reduce((sum, kid) => sum + kid.height, 0) + SIBLING_GAP * Math.max(0, kids.length - 1)
  return { item, kids, height: Math.max(item.height, stacked) }
}

/**
 * Converts one company's top-level OrganizationTreeNode[] into React Flow
 * nodes/edges as a left-to-right branching tree: each level is a column, a
 * manager's reports are stacked in the next column to its right and the
 * manager sits centred against them, joined by elbow connectors. A manager
 * with 25 reports is therefore one tall column of branches rather than one
 * 25-card-wide row (which is what made the old top-down chart unreadable).
 *
 * A node's children are only walked into the graph when expandedIds has it
 * (or visibility.forceExpandIds does — a search/filter match's ancestors
 * auto-expand regardless of manual state) AND visibility allows it. When a
 * `company` is given, a synthetic card sits on the far left and the roots
 * branch from it (also for a single root, so the company name is always
 * visible).
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
      : // Several roots and no company card: stack them as siblings under an invisible parent.
        { id: "__virtual__", height: 0, kind: "virtual", data: { label: "", headcount: 0 }, children: rootItems }

  const nodes: OrgChartLayoutNode[] = []
  const edges: Edge[] = []

  function place(block: Block, level: number, blockTop: number, parent: Item | null) {
    const { item } = block
    const isVirtual = item.kind === "virtual"
    const x = level * ORG_CHART_LEVEL_PITCH
    // The card sits vertically centred against its own branch.
    const y = blockTop + (block.height - item.height) / 2

    if (!isVirtual) {
      if (item.kind === "company") {
        nodes.push({
          id: item.id,
          type: "orgChartCompany",
          position: { x, y },
          style: { width: ORG_CHART_NODE_WIDTH, height: item.height },
          data: item.data as OrgChartCompanyData,
          draggable: false,
          connectable: false,
        })
      } else {
        nodes.push({
          id: item.id,
          type: "orgChartNode",
          position: { x, y },
          style: { width: ORG_CHART_NODE_WIDTH, height: item.height },
          data: item.data as OrgChartNodeData,
          draggable: false,
          connectable: false,
        })
      }
    }

    if (parent && parent.kind !== "virtual") {
      edges.push({ id: `${parent.id}->${item.id}`, source: parent.id, target: item.id, type: "smoothstep" })
    }

    if (block.kids.length === 0) return
    const stacked = block.kids.reduce((sum, kid) => sum + kid.height, 0) + SIBLING_GAP * (block.kids.length - 1)
    // Children are centred against the card when they are shorter than it.
    let cursor = blockTop + (block.height - stacked) / 2
    // An invisible parent takes no column: its children start at the same level.
    const childLevel = isVirtual ? level : level + 1
    for (const kid of block.kids) {
      place(kid, childLevel, cursor, item)
      cursor += kid.height + SIBLING_GAP
    }
  }

  place(measure(top), 0, 0, null)
  return { nodes, edges }
}
