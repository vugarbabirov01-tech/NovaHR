import dagre from "dagre"
import type { Edge, Node } from "@xyflow/react"

import type { OrganizationChartVisibilityResult } from "@/lib/organization/filter-tree"
import type { OrganizationTreeNode } from "@/types/organization"

export const ORG_CHART_NODE_WIDTH = 264
export const ORG_CHART_NODE_HEIGHT = 96

export interface OrgChartNodeData extends Record<string, unknown> {
  node: OrganizationTreeNode
  hasChildren: boolean
  isExpanded: boolean
  isMatch: boolean
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

  function visit(node: OrganizationTreeNode) {
    if (visibility.visibleIds && !visibility.visibleIds.has(node.employee.id)) return

    const hasChildren = node.children.length > 0
    const isExpanded =
      hasChildren && (expandedIds.has(node.employee.id) || visibility.forceExpandIds.has(node.employee.id))
    const isMatch = visibility.matchedIds.has(node.employee.id)

    nodeData.push({ node, hasChildren, isExpanded, isMatch })
    graph.setNode(node.employee.id, { width: ORG_CHART_NODE_WIDTH, height: ORG_CHART_NODE_HEIGHT })

    if (!isExpanded) return
    for (const child of node.children) {
      if (visibility.visibleIds && !visibility.visibleIds.has(child.employee.id)) continue
      graph.setEdge(node.employee.id, child.employee.id)
      edges.push({ id: `${node.employee.id}->${child.employee.id}`, source: node.employee.id, target: child.employee.id })
      visit(child)
    }
  }

  for (const root of roots) visit(root)

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
