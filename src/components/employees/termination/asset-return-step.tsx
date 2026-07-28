"use client"

import { useTranslations } from "next-intl"
import { PackageX } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/common/empty-state"
import { EnumSelect } from "@/components/common/enum-select"
import { FormSection } from "@/components/common/form-section"
import type { AssetAssignment } from "@/types/integrations/asset-management"
import type { AssetStatus } from "@/types/employee-profile"

interface StepProps {
  assets: AssetAssignment[]
  value: Record<string, AssetStatus>
  onChange: (value: Record<string, AssetStatus>) => void
  isLoading: boolean
}

const statuses: AssetStatus[] = ["returned", "assigned", "lost", "damaged"]

export function AssetReturnStep({ assets, value, onChange, isLoading }: StepProps) {
  const t = useTranslations("Employees.termination.assets")
  const tStatus = useTranslations("Employees.profile.assets.status")
  const tCategories = useTranslations("Employees.profile.assets.categories")
  const tCommon = useTranslations("Common")

  if (isLoading) {
    return <FormSection title={t("title")}>{t("loading")}</FormSection>
  }

  if (assets.length === 0) {
    return (
      <FormSection title={t("title")}>
        <Card>
          <CardContent>
            <EmptyState icon={PackageX} title={t("noAssets")} />
          </CardContent>
        </Card>
      </FormSection>
    )
  }

  const resolvedStatus = (asset: AssetAssignment) => value[asset.id] ?? asset.status
  const returnedCount = assets.filter((asset) => resolvedStatus(asset) === "returned").length
  const outstandingCount = assets.length - returnedCount

  return (
    <FormSection title={t("title")} description={t("description")}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">{t("returnedAssets")}</p>
          <p className="font-heading text-xl font-semibold text-foreground tabular-nums">{returnedCount}</p>
        </div>
        <div className="rounded-lg border border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">{t("outstandingAssets")}</p>
          <p className="font-heading text-xl font-semibold text-foreground tabular-nums">
            {outstandingCount}
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {assets.map((asset) => (
          <li
            key={asset.id}
            className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{asset.name}</span>
              <span className="text-xs text-muted-foreground">
                {tCategories(asset.category)} · {asset.assetTag}
              </span>
            </div>
            <EnumSelect
              value={resolvedStatus(asset)}
              onValueChange={(v) => onChange({ ...value, [asset.id]: v as AssetStatus })}
              options={statuses.map((status) => ({ value: status, label: tStatus(status) }))}
              placeholder={tCommon("selectPlaceholder")}
              className="sm:w-44"
            />
          </li>
        ))}
      </ul>
    </FormSection>
  )
}
