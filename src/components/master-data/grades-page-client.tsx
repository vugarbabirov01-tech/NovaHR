"use client"

import { useOptimistic, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { MasterDataList, type MasterDataListLabels } from "@/components/master-data/master-data-list"
import { GradeFormDialog } from "@/components/master-data/grade-form-dialog"
import {
  archiveGradeAction,
  createGradeAction,
  restoreGradeAction,
  updateGradeAction,
} from "@/app/[locale]/(app)/grades/actions"
import type { Grade, GradeInput } from "@/repositories/grade-repository"

type OptimisticAction =
  | { type: "upsert"; grade: Grade }
  | { type: "setActive"; id: string; active: boolean }

function reducer(state: Grade[], action: OptimisticAction): Grade[] {
  switch (action.type) {
    case "upsert": {
      const exists = state.some((g) => g.id === action.grade.id)
      return exists ? state.map((g) => (g.id === action.grade.id ? action.grade : g)) : [...state, action.grade]
    }
    case "setActive":
      return state.map((g) => (g.id === action.id ? { ...g, active: action.active } : g))
  }
}

interface GradesPageClientProps {
  initialGrades: Grade[]
}

export function GradesPageClient({ initialGrades }: GradesPageClientProps) {
  const t = useTranslations("Pages.grades")
  const tCommon = useTranslations("Common")
  const [optimisticGrades, dispatchOptimistic] = useOptimistic(initialGrades, reducer)
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Grade | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const labels: MasterDataListLabels = {
    searchPlaceholder: t("searchPlaceholder"),
    active: tCommon("active"),
    archived: tCommon("archived"),
    statusColumn: t("columnStatus"),
    actionsColumn: t("columnActions"),
    newButton: t("addTitle"),
    edit: tCommon("edit"),
    archive: tCommon("archive"),
    restore: tCommon("restore"),
    emptyTitle: t("emptyTitle"),
    emptyDescription: t("emptyDescription"),
  }

  const columns: ColumnDef<Grade>[] = [
    { accessorKey: "name", header: t("columnName") },
    { accessorKey: "code", header: t("columnCode") },
    {
      accessorKey: "description",
      header: t("columnDescription"),
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.description || "—"}</span>,
    },
  ]

  function handleArchive(grade: Grade) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: grade.id, active: false })
      const result = await archiveGradeAction(grade.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleRestore(grade: Grade) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: grade.id, active: true })
      const result = await restoreGradeAction(grade.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleSubmit(input: GradeInput) {
    setError(null)
    startTransition(async () => {
      const now = new Date()
      const optimisticGrade: Grade = editing
        ? { ...editing, ...input, description: input.description ?? null }
        : {
            id: `temp-${Date.now()}`,
            code: (input.code || input.name).toUpperCase(),
            name: input.name,
            description: input.description ?? null,
            active: true,
            createdAt: now,
            updatedAt: now,
          }
      dispatchOptimistic({ type: "upsert", grade: optimisticGrade })

      const result = editing ? await updateGradeAction(editing.id, input) : await createGradeAction(input)

      if (result.success) {
        setDialogOpen(false)
        setEditing(undefined)
      } else {
        setError(result.error ?? tCommon("genericError"))
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <MasterDataList
        records={optimisticGrades}
        columns={columns}
        matchesSearch={(grade, query) =>
          grade.name.toLowerCase().includes(query) || grade.code.toLowerCase().includes(query)
        }
        labels={labels}
        onNew={() => {
          setEditing(undefined)
          setDialogOpen(true)
        }}
        onEdit={(grade) => {
          setEditing(grade)
          setDialogOpen(true)
        }}
        onArchive={handleArchive}
        onRestore={handleRestore}
      />
      <GradeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        grade={editing}
        onSubmit={handleSubmit}
        isSaving={isPending}
      />
    </div>
  )
}
