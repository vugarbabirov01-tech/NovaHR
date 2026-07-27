"use client"

import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { Progress } from "@/components/ui/progress"

interface ValidateStepProps {
  progress: { processed: number; total: number } | null
  totalRows: number
}

export function ValidateStep({ progress, totalRows }: ValidateStepProps) {
  const t = useTranslations("Employees.import.validate")
  const total = progress?.total ?? totalRows
  const processed = progress?.processed ?? 0
  const percent = total > 0 ? (processed / total) * 100 : 0

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
      <div className="flex flex-col gap-1">
        <p className="font-heading text-base font-semibold text-foreground">{t("title")}</p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("progress", { processed, total })}
        </p>
      </div>
      <Progress value={percent} className="w-full max-w-sm" />
    </div>
  )
}
