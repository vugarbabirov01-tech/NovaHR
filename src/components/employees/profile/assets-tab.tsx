"use client"

import { useTranslations } from "next-intl"
import {
  Laptop,
  Smartphone,
  Car,
  Shirt,
  CreditCard,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/common/empty-state"
import type { AssetCategory, AssetStatus, EmployeeProfile } from "@/types/employee-profile"

interface AssetsTabProps {
  profile: EmployeeProfile
}

const categoryIcons: Record<AssetCategory, LucideIcon> = {
  laptop: Laptop,
  phone: Smartphone,
  vehicle: Car,
  uniform: Shirt,
  "access-card": CreditCard,
  equipment: Wrench,
}

const statusVariant: Record<AssetStatus, "secondary" | "outline" | "destructive"> = {
  assigned: "secondary",
  returned: "outline",
  lost: "destructive",
  damaged: "destructive",
}

export function AssetsTab({ profile }: AssetsTabProps) {
  const t = useTranslations("Employees.profile.assets")
  const tCategories = useTranslations("Employees.profile.assets.categories")
  const tStatus = useTranslations("Employees.profile.assets.status")
  const { assets } = profile

  if (assets.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState icon={Wrench} title={t("noAssets")} />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {assets.map((asset) => {
        const Icon = categoryIcons[asset.category]

        return (
          <Card key={asset.id}>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent">
                  <Icon className="size-4 text-accent-foreground" strokeWidth={1.75} />
                </div>
                <Badge variant={statusVariant[asset.status]}>{tStatus(asset.status)}</Badge>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">{asset.name}</p>
                <p className="text-xs text-muted-foreground">{tCategories(asset.category)}</p>
              </div>
              <div className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>{t("assetTag")}</span>
                  <span className="tabular-nums text-foreground">{asset.assetTag}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("assignedDate")}</span>
                  <span className="tabular-nums text-foreground">{asset.assignedDate}</span>
                </div>
                {asset.returnedDate ? (
                  <div className="flex justify-between">
                    <span>{t("returnedDate")}</span>
                    <span className="tabular-nums text-foreground">{asset.returnedDate}</span>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
