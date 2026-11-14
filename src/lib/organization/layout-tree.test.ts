import { describe, expect, it } from "vitest"

import {
  INLINE_FANOUT_LIMIT,
  ORG_CHART_COMPANY_NODE_HEIGHT,
  ORG_CHART_COMPANY_NODE_ID,
  ORG_CHART_LEAF_HEIGHT,
  ORG_CHART_LEVEL_PITCH,
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

describe("layoutOrganizationChart (left to right)", () => {
  it("puts each level in its own column to the right of its manager", () => {
    const root = node("boss", [node("m", leaves("a", 2)), node("n")])
    const { nodes } = layoutOrganizationChart([root], expandAll(root), visibility)

    expect(byId(nodes, "boss").position.x).toBe(0)
    expect(byId(nodes, "m").position.x).toBe(ORG_CHART_LEVEL_PITCH)
    expect(byId(nodes, "n").position.x).toBe(ORG_CHART_LEVEL_PITCH)
    expect(byId(nodes, "a0").position.x).toBe(ORG_CHART_LEVEL_PITCH * 2)
    assertNoOverlaps(nodes)
  })

  it("stacks siblings in one column and centres the manager against them", () => {
    const root = node("boss", leaves("r", 5))
    const { nodes } = layoutOrganizationChart([root], expandAll(root), visibility)

    const reports = nodes.filter((n) => n.id.startsWith("r"))
    expect(new Set(reports.map((n) => n.position.x)).size).toBe(1)
    const ys = reports.map((n) => n.position.y)
    expect([...ys].sort((a, b) => a - b)).toEqual(ys)

    const first = reports[0]
    const last = reports[reports.length - 1]
    const reportsMid = (first.position.y + last.position.y + height(last)) / 2
    const boss = byId(nodes, "boss")
    expect(boss.position.y + height(boss) / 2).toBeCloseTo(reportsMid, 5)
  })

  it("keeps 25 reports in one narrow column and gives sub-branches their own columns without overlaps", () => {
    const managers = Array.from({ length: 6 }, (_, i) => node(`m${i}`, leaves(`m${i}-`, 3)))
    const root = node("boss", [...managers, ...leaves("x", 19)])
    const { nodes } = layoutOrganizationChart([root], expandAll(root), visibility)

    expect(nodes).toHaveLength(1 + 25 + 18)
    const maxX = Math.max(...nodes.map((n) => n.position.x + ORG_CHART_NODE_WIDTH))
    expect(maxX).toBe(ORG_CHART_LEVEL_PITCH * 2 + ORG_CHART_NODE_WIDTH)
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

  it("branches the top-level managers from a company card on the left", () => {
    const roots = Array.from({ length: 3 }, (_, i) => node(`top${i}`, leaves(`t${i}-`, 2)))
    const { nodes, edges } = layoutOrganizationChart(roots, new Set(), visibility, { label: "Şirkət", headcount: 12 })

    const company = byId(nodes, ORG_CHART_COMPANY_NODE_ID)
    expect(company.type).toBe("orgChartCompany")
    expect(company.data).toMatchObject({ label: "Şirkət", headcount: 12 })
    expect(height(company)).toBe(ORG_CHART_COMPANY_NODE_HEIGHT)
    expect(company.position.x).toBe(0)
    expect(roots.every((_, i) => byId(nodes, `top${i}`).position.x === ORG_CHART_LEVEL_PITCH)).toBe(true)
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

  it("lays several roots in one column when there is no company card", () => {
    const roots = [node("a"), node("b"), node("c")]
    const { nodes, edges } = layoutOrganizationChart(roots, new Set(), visibility)
    expect(nodes.map((n) => n.position.x)).toEqual([0, 0, 0])
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
