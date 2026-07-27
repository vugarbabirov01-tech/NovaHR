"use client"

import { useTranslations } from "next-intl"
import { Check, X } from "lucide-react"

import { cn } from "@/lib/utils"

interface BooleanIndicatorProps {
  value: boolean
  className?: string
}

export function BooleanIndicator({ value, className }: BooleanIndicatorProps) {
  const t = useTranslations("Employees.profile.labourLaw")

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium",
        value ? "text-status-good" : "text-muted-foreground",
        className
      )}
    >
      {value ? (
        <Check className="size-3.5" strokeWidth={2.25} />
      ) : (
        <X className="size-3.5" strokeWidth={2.25} />
      )}
      {value ? t("yes") : t("no")}
    </span>
  )
}
