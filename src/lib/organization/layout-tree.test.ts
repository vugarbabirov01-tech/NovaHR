import { describe, expect, it } from "vitest"

import {
  INLINE_FANOUT_LIMIT,
  ORG_CHART_COMPANY_NODE_HEIGHT,
  ORG_CHART_COMPANY_NODE_ID,
  ORG_CHART_LEAF_HEIGHT,
  ORG_CHART_LEVEL_GAP,
  ORG_CHART_ROW_LIMIT,
  ORG_CHART_GRID_COLUMNS,
  ORG_CHART_NODE_HEIGHT,
  ORG_CHART_NODE_WIDTH,
  layoutOrganizationChart,
  type OrgChartLayoutNode,
} from "@/lib/organization/layout-tree"
import type { OrganizationChartVisibilityResult } from "@/lib/organization/filter-tree"
import type { OrganizationTreeNode } from "@/types/organization"

const visibility: OrganizationChartVisibilityResult = {
  visibleIds: null,
  matchedIds: new Set(),
  forceExpandIds: new Set(),
} as unknown as OrganizationChartVisibilityResult

function node(id: string, children: OrganizationTreeNode[] = []): OrganizationTreeNode {
  return { employee: { id } as OrganizationTreeNode["employee"], children, descendantCount: children.length }
}

function leaves(prefix: string, count: number): OrganizationTreeNode[] {
  return Array.from({ length: count }, (_, i) => node(`${prefix}${i}`))
}

function expandAll(root: OrganizationTreeNode, ids = new Set<string>()): Set<string> {
  ids.add(root.employee.id)
  root.children.forEach((child) => expandAll(child, ids))
  return ids
}

function height(n: OrgChartLayoutNode): number {
  return Number((n.style as { height: number }).height)
}

function overlaps(a: OrgChartLayoutNode, b: OrgChartLayoutNode) {
  return (
    a.position.x < b.position.x + ORG_CHART_NODE_WIDTH &&
    b.position.x < a.position.x + ORG_CHART_NODE_WIDTH &&
    a.position.y < b.position.y + height(b) &&
    b.position.y < a.position.y + height(a)
  )
}

function assertNoOverlaps(nodes: OrgChartLayoutNode[]) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      expect(overlaps(nodes[i], nodes[j])).toBe(false)
    }
  }
}

const byId = (nodes: OrgChartLayoutNode[], id: string) => nodes.find((n) => n.id === id)!

describe("layoutOrganizationChart (top-down, hybrid)", () => {
  it("puts each level in its own row below its manager, centred under it", () => {
    const root = node("boss", [node("m", leaves("a", 2)), node("n")])
    const { nodes } = layoutOrganizationChart([root], expandAll(root), visibility)

    // Reports of m sit one more row down.
    expect(byId(nodes, "a0").position.y).toBe(byId(nodes, "m").position.y + ORG_CHART_NODE_HEIGHT + ORG_CHART_LEVEL_GAP)

    const boss = byId(nodes, "boss")
    const m = byId(nodes, "m")
    const n = byId(nodes, "n")
    expect(boss.position.y).toBe(0)
    expect(m.position.y).toBe(ORG_CHART_NODE_HEIGHT + ORG_CHART_LEVEL_GAP)
    expect(n.position.y).toBe(m.position.y)
    expect(m.position.x).toBeLessThan(n.position.x)
    assertNoOverlaps(nodes)
  })

  it("centres a manager over a flat row of reports", () => {
    const root = node("boss", leaves("r", 4))
    const { nodes } = layoutOrganizationChart([root], expandAll(root), visibility)
    const reports = nodes.filter((n) => n.id.startsWith("r"))
    const first = reports[0]
    const last = reports[reports.length - 1]
    expect(byId(nodes, "boss").position.x + ORG_CHART_NODE_WIDTH / 2).toBeCloseTo(
      (first.position.x + last.position.x + ORG_CHART_NODE_WIDTH) / 2,
      5
    )
  })

  it("keeps up to the row limit side by side", () => {
    const root = node("boss", leaves("r", ORG_CHART_ROW_LIMIT))
    const { nodes, edges } = layoutOrganizationChart([root], expandAll(root), visibility)
    const reports = nodes.filter((n) => n.id.startsWith("r"))
    expect(new Set(reports.map((n) => n.position.y)).size).toBe(1)
    expect(edges.every((edge) => edge.sourceHandle == null && edge.targetHandle == null)).toBe(true)
    assertNoOverlaps(nodes)
  })

  it("wraps more reports than the row limit into a grid", () => {
    const count = ORG_CHART_ROW_LIMIT + 3
    const root = node("boss", leaves("r", count))
    const { nodes, edges } = layoutOrganizationChart([root], expandAll(root), visibility)

    const reports = nodes.filter((n) => n.id.startsWith("r"))
    const rows = new Set(reports.map((n) => n.position.y))
    expect(rows.size).toBe(Math.ceil(count / ORG_CHART_GRID_COLUMNS))
    // No more than the configured number of columns.
    expect(new Set(reports.map((n) => n.position.x)).size).toBeLessThanOrEqual(ORG_CHART_GRID_COLUMNS)
    // Reports in a column line up.
    const first = reports[0]
    expect(reports[ORG_CHART_GRID_COLUMNS].position.x).toBe(first.position.x)
    const boss = byId(nodes, "boss")
    expect(first.position.y).toBe(boss.position.y + ORG_CHART_NODE_HEIGHT + ORG_CHART_LEVEL_GAP)
    expect(edges).toHaveLength(count)
    expect(edges.every((edge) => edge.source === "boss" && edge.sourceHandle == null)).toBe(true)
    assertNoOverlaps(nodes)
  })

  it("keeps a big team compact: 25 reports are neither one tall column nor one wide row", () => {
    const managers = Array.from({ length: 6 }, (_, i) => node(`m${i}`, leaves(`m${i}-`, 3)))
    const root = node("boss", [...managers, ...leaves("x", 19)])
    const { nodes } = layoutOrganizationChart([root], expandAll(root), visibility)

    expect(nodes).toHaveLength(1 + 25 + 18)
    const maxX = Math.max(...nodes.map((n) => n.position.x + ORG_CHART_NODE_WIDTH))
    const minX = Math.min(...nodes.map((n) => n.position.x))
    // With every sub-branch open (3 reports each) it is still about half of one 25-card row.
    expect(maxX - minX).toBeLessThan(ORG_CHART_NODE_WIDTH * 14)
    assertNoOverlaps(nodes)
  })

  it("uses compact cards for people without reports and full cards for managers", () => {
    const root = node("boss", [node("m", leaves("a", 1)), node("n")])
    const { nodes } = layoutOrganizationChart([root], expandAll(root), visibility)
    expect(height(byId(nodes, "boss"))).toBe(ORG_CHART_NODE_HEIGHT)
    expect(height(byId(nodes, "m"))).toBe(ORG_CHART_NODE_HEIGHT)
    expect(height(byId(nodes, "n"))).toBe(ORG_CHART_LEAF_HEIGHT)
    expect(height(byId(nodes, "a0"))).toBe(ORG_CHART_LEAF_HEIGHT)
  })

  it("connects every report to its manager with an elbow edge", () => {
    const root = node("boss", leaves("r", 3))
    const { edges } = layoutOrganizationChart([root], expandAll(root), visibility)
    expect(edges).toHaveLength(3)
    expect(edges.every((edge) => edge.source === "boss" && edge.type === "smoothstep")).toBe(true)
    expect(edges.every((edge) => edge.sourceHandle == null && edge.targetHandle == null)).toBe(true)
  })

  it("does not walk into collapsed branches", () => {
    const root = node("boss", [node("a", leaves("a-", 3)), node("b")])
    const { nodes } = layoutOrganizationChart([root], new Set(["boss"]), visibility)
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "b", "boss"])
  })

  it("branches the top-level managers from a company card on top", () => {
    const roots = Array.from({ length: 3 }, (_, i) => node(`top${i}`, leaves(`t${i}-`, 2)))
    const { nodes, edges } = layoutOrganizationChart(roots, new Set(), visibility, { label: "Şirkət", headcount: 12 })

    const company = byId(nodes, ORG_CHART_COMPANY_NODE_ID)
    expect(company.type).toBe("orgChartCompany")
    expect(company.data).toMatchObject({ label: "Şirkət", headcount: 12 })
    expect(height(company)).toBe(ORG_CHART_COMPANY_NODE_HEIGHT)
    expect(company.position.y).toBe(0)
    const rowY = ORG_CHART_COMPANY_NODE_HEIGHT + ORG_CHART_LEVEL_GAP
    expect(roots.every((_, i) => byId(nodes, `top${i}`).position.y === rowY)).toBe(true)
    expect(nodes).toHaveLength(4)
    expect(edges).toHaveLength(3)
    expect(edges.every((edge) => edge.source === ORG_CHART_COMPANY_NODE_ID)).toBe(true)
    assertNoOverlaps(nodes)
  })

  it("keeps the company card with a single top-level manager", () => {
    const root = node("boss", leaves("r", 2))
    const { nodes, edges } = layoutOrganizationChart([root], new Set(), visibility, { label: "Şirkət", headcount: 3 })
    expect(nodes.map((n) => n.id)).toEqual([ORG_CHART_COMPANY_NODE_ID, "boss"])
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ source: ORG_CHART_COMPANY_NODE_ID, target: "boss" })
  })

  it("lays several roots in one row when there is no company card", () => {
    const roots = [node("a"), node("b"), node("c")]
    const { nodes, edges } = layoutOrganizationChart(roots, new Set(), visibility)
    expect(new Set(nodes.map((n) => n.position.y)).size).toBe(1)
    expect(edges).toEqual([])
    assertNoOverlaps(nodes)
  })

  it("returns nothing when nothing is visible", () => {
    const none = { ...visibility, visibleIds: new Set<string>() } as unknown as OrganizationChartVisibilityResult
    expect(layoutOrganizationChart([node("boss")], new Set(), none, { label: "x", headcount: 1 })).toEqual({
      nodes: [],
      edges: [],
    })
  })

  it("caps inline expansion of very large teams but never for the top level", () => {
    const big = node("big", leaves("k", INLINE_FANOUT_LIMIT + 1))
    const root = node("boss", [big])
    const { nodes } = layoutOrganizationChart([root], expandAll(root), visibility)
    expect((byId(nodes, "big").data as { exceedsInlineFanout: boolean }).exceedsInlineFanout).toBe(true)
    expect(nodes.some((n) => n.id.startsWith("k"))).toBe(false)

    const asRoot = layoutOrganizationChart([big], expandAll(big), visibility)
    expect(asRoot.nodes).toHaveLength(1 + INLINE_FANOUT_LIMIT + 1)
  })
})
