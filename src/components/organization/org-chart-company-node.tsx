"use client"

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { useTranslations } from "next-intl"
import { Building2 } from "lucide-react"

import type { OrgChartCompanyData } from "@/lib/organization/layout-tree"

export type OrgChartCompanyNodeType = Node<OrgChartCompanyData, "orgChartCompany">

/** The top card that joins several top-level managers under their company. */
export function OrgChartCompanyNode({ data }: NodeProps<OrgChartCompanyNodeType>) {
  const t = useTranslations("OrganizationChart")

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      className="relative flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 shadow-sm"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Building2 className="size-5" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-foreground">{data.label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{t("companyHeadcount", { count: data.headcount })}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-border" />
    </div>
  )
}
