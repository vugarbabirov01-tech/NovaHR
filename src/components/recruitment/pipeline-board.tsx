"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { ArrowRight } from "lucide-react"

import { moveApplicationAction } from "@/app/[locale]/(app)/recruitment/actions"
import { AddCandidateDialog } from "@/components/recruitment/add-candidate-dialog"
import { ApplicationSheet } from "@/components/recruitment/application-sheet"
import type { ApplicationView } from "@/components/recruitment/recruitment-types"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useRouter } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { PIPELINE_STAGES, isFinalStage, type PipelineStage } from "@/lib/recruitment/recruitment-rules"

interface PipelineBoardProps {
  requisitionId: string
  applications: ApplicationView[]
  /** Candidates can be added and moved only while the vacancy is open. */
  open: boolean
}

const FORWARD: Partial<Record<PipelineStage, PipelineStage>> = {
  NEW: "SCREENING",
  SCREENING: "INTERVIEW",
  INTERVIEW: "OFFER",
}

const stageAccent: Record<PipelineStage, string> = {
  NEW: "bg-muted-foreground",
  SCREENING: "bg-sky-500",
  INTERVIEW: "bg-violet-500",
  OFFER: "bg-status-warning",
  HIRED: "bg-status-good",
  REJECTED: "bg-destructive",
}

export function PipelineBoard({ requisitionId, applications, open }: PipelineBoardProps) {
  const t = useTranslations("Recruitment")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Looked up by id so the open panel follows fresh data after a refresh.
  const selected = applications.find((application) => application.id === selectedId) ?? null

  function advance(application: ApplicationView) {
    const next = FORWARD[application.stage]
    if (!next) return
    startTransition(async () => {
      const result = await moveApplicationAction(application.id, next)
      if (result.success) router.refresh()
      else toast.error(t(`errors.${result.code}` as never))
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{t("pipeline.title")}</h2>
        {open ? (
          <AddCandidateDialog requisitionId={requisitionId} />
        ) : (
          <span className="text-xs text-muted-foreground">{t("pipeline.notOpenHint")}</span>
        )}
      </div>

      <div className="grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((stage) => {
          const items = applications.filter((application) => application.stage === stage)
          return (
            <div key={stage} className="flex min-h-40 flex-col gap-2 rounded-xl bg-muted/50 p-2">
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className={cn("size-2 rounded-full", stageAccent[stage])} />
                  {t(`stage.${stage}` as never)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <p className="px-1 py-3 text-xs text-muted-foreground">{t("pipeline.emptyColumn")}</p>
              ) : (
                items.map((application) => (
                  <div
                    key={application.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(application.id)}
                    onKeyDown={(event) => event.key === "Enter" && setSelectedId(application.id)}
                    className="flex cursor-pointer flex-col gap-1 rounded-lg border border-border bg-card p-3 text-sm shadow-xs transition-colors hover:border-primary/40"
                  >
                    <span className="font-medium text-foreground">{application.candidate.fullName}</span>
                    <span className="text-xs text-muted-foreground">
                      {application.candidate.phone || application.candidate.email}
                    </span>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t(`source.${application.candidate.source}` as never)}
                      </span>
                      {open && !isFinalStage(application.stage) && FORWARD[application.stage] ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={pending}
                          aria-label={t("pipeline.advance")}
                          onClick={(event) => {
                            event.stopPropagation()
                            advance(application)
                          }}
                        >
                          <ArrowRight className="size-3.5" strokeWidth={1.75} />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>

      <ApplicationSheet
        application={selected}
        canMove={open}
        onOpenChange={(isOpen) => !isOpen && setSelectedId(null)}
      />
    </div>
  )
}
