"use client"

import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { ImportRow } from "@/lib/employee-import/types"

interface ImportStepProps {
  rows: ImportRow[]
  progress: { processed: number; total: number } | null
  isImporting: boolean
  onStart: () => void
  onBack: () => void
}

export function ImportStep({ rows, progress, isImporting, onStart, onBack }: ImportStepProps) {
  const t = useTranslations("Employees.import.import")

  const willImportCount = rows.filter((r) => r.severity !== "error" && !r.willSkipAsDuplicate).length
  const willSkipCount = rows.filter((r) => r.willSkipAsDuplicate).length
  const blockedCount = rows.filter((r) => r.severity === "error").length

  if (isImporting) {
    const total = progress?.total ?? rows.length
    const processed = progress?.processed ?? 0
    const percent = total > 0 ? (processed / total) * 100 : 0
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
        <p className="font-heading text-base font-semibold text-foreground">{t("importing")}</p>
        <p className="text-sm text-muted-foreground tabular-nums">{t("progress", { processed, total })}</p>
        <Progress value={percent} className="w-full max-w-sm" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-base font-semibold text-foreground">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("confirmation", { willImport: willImportCount, skipped: willSkipCount, blocked: blockedCount })}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          {t("back")}
        </Button>
        <Button onClick={onStart}>{t("startImport")}</Button>
      </div>
    </div>
  )
}
