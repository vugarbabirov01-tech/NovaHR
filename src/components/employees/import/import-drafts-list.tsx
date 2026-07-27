"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { FileSpreadsheet, Trash2 } from "lucide-react"

import { useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { deleteImportDraftAction } from "@/app/[locale]/(app)/employees/import/actions"
import type { ImportDraft } from "@/lib/employee-import/types"

/**
 * `toLocaleString()` resolves to the server's locale during SSR and the
 * visiting browser's locale during hydration — the exact class of mismatch
 * already fixed for the wizard Progress bar. Plain UTC field extraction has
 * no such dependency, so it renders identically both times.
 */
function formatDraftTimestamp(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

interface ImportDraftsListProps {
  drafts: ImportDraft[]
  onResume: (draft: ImportDraft) => void
}

export function ImportDraftsList({ drafts, onResume }: ImportDraftsListProps) {
  const t = useTranslations("Employees.import.drafts")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  if (drafts.length === 0) return null

  function handleDelete(id: string) {
    setPendingDeleteId(id)
    startTransition(async () => {
      await deleteImportDraftAction(id)
      router.refresh()
      setPendingDeleteId(null)
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 className="font-heading text-sm font-semibold text-foreground">{t("title")}</h3>
        <div className="flex flex-col gap-2">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{draft.fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("rowCount", { count: draft.rawRows.length })} ·{" "}
                    {formatDraftTimestamp(draft.updatedAt)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" onClick={() => onResume(draft)}>
                  {t("resume")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t("delete")}
                  disabled={isPending && pendingDeleteId === draft.id}
                  onClick={() => handleDelete(draft.id)}
                >
                  <Trash2 className="size-4 text-destructive" strokeWidth={1.75} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
