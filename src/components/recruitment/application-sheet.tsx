"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"

import { addApplicationNoteAction, moveApplicationAction } from "@/app/[locale]/(app)/recruitment/actions"
import type { ApplicationView } from "@/components/recruitment/recruitment-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useRouter } from "@/i18n/navigation"
import { formatReportDate } from "@/lib/reports/format-date"
import { PIPELINE_STAGES, isFinalStage } from "@/lib/recruitment/recruitment-rules"

interface ApplicationSheetProps {
  application: ApplicationView | null
  canMove: boolean
  onOpenChange: (open: boolean) => void
}

export function ApplicationSheet({ application, canMove, onOpenChange }: ApplicationSheetProps) {
  const t = useTranslations("Recruitment")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [target, setTarget] = useState("")
  const [reason, setReason] = useState("")
  const [noteKind, setNoteKind] = useState<"NOTE" | "INTERVIEW">("NOTE")
  const [noteText, setNoteText] = useState("")
  const [rating, setRating] = useState("")

  function done(result: { success: true } | { success: false; code: string }, after?: () => void) {
    if (result.success) {
      after?.()
      router.refresh()
    } else {
      toast.error(t(`errors.${result.code}` as never))
    }
  }

  function handleMove() {
    if (!application || !target) return
    startTransition(async () =>
      done(await moveApplicationAction(application.id, target, reason), () => {
        setTarget("")
        setReason("")
      })
    )
  }

  function handleAddNote() {
    if (!application) return
    startTransition(async () =>
      done(
        await addApplicationNoteAction(application.id, {
          kind: noteKind,
          text: noteText,
          rating: noteKind === "INTERVIEW" && rating ? Number(rating) : null,
        }),
        () => {
          setNoteText("")
          setRating("")
        }
      )
    )
  }

  const movable = application && canMove && !isFinalStage(application.stage)

  return (
    <Sheet open={application !== null} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        {application ? (
          <>
            <SheetHeader>
              <SheetTitle>{application.candidate.fullName}</SheetTitle>
              <SheetDescription>
                {t(`stage.${application.stage}` as never)} · {formatReportDate(application.stageUpdatedAt)}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 pb-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {application.candidate.phone ? (
                  <>
                    <dt className="text-muted-foreground">{t("candidateForm.phone")}</dt>
                    <dd className="tabular-nums">{application.candidate.phone}</dd>
                  </>
                ) : null}
                {application.candidate.email ? (
                  <>
                    <dt className="text-muted-foreground">{t("candidateForm.email")}</dt>
                    <dd>{application.candidate.email}</dd>
                  </>
                ) : null}
                {application.candidate.finCode ? (
                  <>
                    <dt className="text-muted-foreground">{t("candidateForm.finCode")}</dt>
                    <dd className="tabular-nums">{application.candidate.finCode}</dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">{t("candidateForm.source")}</dt>
                <dd>{t(`source.${application.candidate.source}` as never)}</dd>
              </dl>
              {application.candidate.notes ? (
                <p className="text-sm text-muted-foreground">{application.candidate.notes}</p>
              ) : null}
              {application.stage === "REJECTED" && application.rejectionReason ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                  <span className="font-medium">{t("sheet.rejectionReason")}: </span>
                  {application.rejectionReason}
                </p>
              ) : null}

              {movable ? (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("sheet.moveTitle")}</h3>
                    <select
                      className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                      value={target}
                      onChange={(event) => setTarget(event.target.value)}
                    >
                      <option value="">{t("sheet.moveTo")}</option>
                      {PIPELINE_STAGES.filter((stage) => stage !== application.stage).map((stage) => (
                        <option key={stage} value={stage}>
                          {t(`stage.${stage}` as never)}
                        </option>
                      ))}
                    </select>
                    {target === "REJECTED" ? (
                      <Input placeholder={t("sheet.rejectionReason")} value={reason} onChange={(e) => setReason(e.target.value)} />
                    ) : null}
                    <Button size="sm" disabled={pending || !target} onClick={handleMove}>
                      {t("sheet.move")}
                    </Button>
                  </div>
                </>
              ) : null}

              <Separator />
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("sheet.notesTitle")}</h3>
                {application.notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("sheet.noNotes")}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {application.notes.map((note) => (
                      <li key={note.id} className="rounded-lg border border-border p-3 text-sm">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {t(`sheet.kind.${note.kind}` as never)}
                            {note.rating ? ` · ${note.rating}/5` : ""}
                          </span>
                          <span className="tabular-nums">{formatReportDate(note.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-foreground">{note.text}</p>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
                  <div className="flex gap-2">
                    {(["NOTE", "INTERVIEW"] as const).map((kind) => (
                      <Button
                        key={kind}
                        type="button"
                        size="sm"
                        variant={noteKind === kind ? "default" : "outline"}
                        onClick={() => setNoteKind(kind)}
                      >
                        {t(`sheet.kind.${kind}` as never)}
                      </Button>
                    ))}
                    {noteKind === "INTERVIEW" ? (
                      <select
                        className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                        value={rating}
                        onChange={(event) => setRating(event.target.value)}
                        aria-label={t("sheet.rating")}
                      >
                        <option value="">{t("sheet.rating")}</option>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option key={value} value={value}>
                            {value}/5
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                  <Textarea rows={3} placeholder={t("sheet.notePlaceholder")} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  <Button size="sm" disabled={pending || !noteText.trim()} onClick={handleAddNote}>
                    {t("sheet.addNote")}
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
