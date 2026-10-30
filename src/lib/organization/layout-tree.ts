import dagre from "dagre"
import type { Edge, Node } from "@xyflow/react"

import type { OrganizationChartVisibilityResult } from "@/lib/organization/filter-tree"
import type { OrganizationTreeNode } from "@/types/organization"

export const ORG_CHART_NODE_WIDTH = 264
export const ORG_CHART_NODE_HEIGHT = 108

/** A manager with more direct reports than this never expands inline — at
 * 23 (today's real maximum, see tmp-org-check.mjs's one-off query during
 * this feature's own investigation) laying every child into one Dagre rank
 * is exactly the "one wide unreadable row" failure this whole redesign
 * exists to avoid. Past the cap, the card offers "view in focus" instead of
 * a chevron, which opens OrgChartCanvas's focus mode on that one manager —
 * bounded width regardless of how large the company grows. */
export const INLINE_FANOUT_LIMIT = 8

export interface OrgChartNodeData extends Record<string, unknown> {
  node: OrganizationTreeNode
  hasChildren: boolean
  isExpanded: boolean
  isMatch: boolean
  /** True once this node's OWN direct-child count passes INLINE_FANOUT_LIMIT
   * — the card renders a "view in focus" action instead of a chevron, since
   * expanding that many children inline is what produced the original
   * one-wide-row layout. Never true for one of THIS call's own top-level
   * `roots` (depth 0) — the whole point of focus mode is that whichever
   * manager you're focused on (or the company's top leader, in the
   * unfocused view) always shows their real direct-report count, however
   * large; the cap only ever stops a DEEPER node from fanning the layout
   * out further before you've chosen to focus on it specifically. A
   * search/filter match still force-expands through a capped node (see
   * layoutOrganizationChart below) — only the manual/default inline toggle
   * is capped, never the ability to find someone. */
  exceedsInlineFanout: boolean
}

/**
 * Converts the same OrganizationTreeNode[] the List view renders (one
 * company's worth of root nodes — see group-by-company.ts; the canvas
 * never mixes two companies' roots into one call) into React Flow
 * nodes/edges, laid out top-down by Dagre.
 *
 * A node's children are only walked into the graph when expandedIds has
 * it (or visibility.forceExpandIds does, same as OrgChartNode's own rule —
 * a search/filter match's ancestors auto-expand regardless of manual
 * state) AND visibility allows it. Collapsed branches are pruned from the
 * LAYOUT itself, not just hidden with CSS, so Dagre never reserves space
 * for a subtree that isn't currently shown and large orgs stay fast to
 * lay out (§9) — only the visible slice of the tree is ever walked.
 */
export function layoutOrganizationChart(
  roots: OrganizationTreeNode[],
  expandedIds: Set<string>,
  visibility: OrganizationChartVisibilityResult
): { nodes: Node<OrgChartNodeData, "orgChartNode">[]; edges: Edge[] } {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: "TB", nodesep: 32, ranksep: 72 })
  graph.setDefaultEdgeLabel(() => ({}))

  const nodeData: OrgChartNodeData[] = []
  const edges: Edge[] = []

  function visit(node: OrganizationTreeNode, depth: number) {
    if (visibility.visibleIds && !visibility.visibleIds.has(node.employee.id)) return

    const hasChildren = node.children.length > 0
    const exceedsInlineFanout = depth > 0 && node.children.length > INLINE_FANOUT_LIMIT
    const isExpanded =
      hasChildren &&
      (visibility.forceExpandIds.has(node.employee.id) ||
        (!exceedsInlineFanout && expandedIds.has(node.employee.id)))
    const isMatch = visibility.matchedIds.has(node.employee.id)

    nodeData.push({ node, hasChildren, isExpanded, isMatch, exceedsInlineFanout })
    graph.setNode(node.employee.id, { width: ORG_CHART_NODE_WIDTH, height: ORG_CHART_NODE_HEIGHT })

    if (!isExpanded) return
    for (const child of node.children) {
      if (visibility.visibleIds && !visibility.visibleIds.has(child.employee.id)) continue
      graph.setEdge(node.employee.id, child.employee.id)
      edges.push({ id: `${node.employee.id}->${child.employee.id}`, source: node.employee.id, target: child.employee.id })
      visit(child, depth + 1)
    }
  }

  for (const root of roots) visit(root, 0)

  dagre.layout(graph)

  // Dagre positions by CENTER; React Flow positions by top-left — shift
  // each node back by half its own box to line the two systems up.
  const nodes: Node<OrgChartNodeData, "orgChartNode">[] = nodeData.map((data) => {
    const position = graph.node(data.node.employee.id)
    return {
      id: data.node.employee.id,
      type: "orgChartNode",
      position: { x: position.x - ORG_CHART_NODE_WIDTH / 2, y: position.y - ORG_CHART_NODE_HEIGHT / 2 },
      data,
      draggable: false,
      connectable: false,
    }
  })

  return { nodes, edges }
}
