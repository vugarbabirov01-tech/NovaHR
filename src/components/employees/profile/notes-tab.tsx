"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Lock, StickyNote } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { EmptyState } from "@/components/common/empty-state"
import type { EmployeeNote, EmployeeProfile } from "@/types/employee-profile"

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

interface NotesTabProps {
  profile: EmployeeProfile
}

export function NotesTab({ profile }: NotesTabProps) {
  const t = useTranslations("Employees.profile.notes")
  const [notes, setNotes] = useState<EmployeeNote[]>(profile.notes)
  const [draft, setDraft] = useState("")

  function addNote() {
    if (!draft.trim()) return
    setNotes([
      {
        id: `NOTE-${Date.now()}`,
        author: "Vugar Babirov",
        date: new Date().toISOString().slice(0, 10),
        content: draft.trim(),
      },
      ...notes,
    ])
    setDraft("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Lock className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("placeholder")}
            rows={3}
          />
          <Button size="sm" className="self-end" onClick={addNote} disabled={!draft.trim()}>
            {t("addNote")}
          </Button>
        </div>

        {notes.length === 0 ? (
          <EmptyState icon={StickyNote} title={t("noNotes")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((note) => (
              <li key={note.id} className="flex gap-3 rounded-lg border border-border p-3">
                <Avatar size="sm">
                  <AvatarFallback className="bg-accent text-[11px] text-accent-foreground">
                    {initialsFromName(note.author)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{note.author}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{note.date}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{note.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
