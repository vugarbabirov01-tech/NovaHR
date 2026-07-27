"use client"

import { useMemo, useOptimistic, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { MasterDataList, type MasterDataListLabels } from "@/components/master-data/master-data-list"
import { PositionFormDialog } from "@/components/master-data/position-form-dialog"
import {
  archivePositionAction,
  createPositionAction,
  restorePositionAction,
  updatePositionAction,
} from "@/app/[locale]/(app)/positions/actions"
import type { Position, PositionInput } from "@/repositories/position-repository"
import type { Department } from "@/repositories/department-repository"

type OptimisticAction =
  | { type: "upsert"; position: Position }
  | { type: "setActive"; id: string; active: boolean }

function reducer(state: Position[], action: OptimisticAction): Position[] {
  switch (action.type) {
    case "upsert": {
      const exists = state.some((p) => p.id === action.position.id)
      return exists
        ? state.map((p) => (p.id === action.position.id ? action.position : p))
        : [...state, action.position]
    }
    case "setActive":
      return state.map((p) => (p.id === action.id ? { ...p, active: action.active } : p))
  }
}

interface PositionsPageClientProps {
  initialPositions: Position[]
  departments: Department[]
}

export function PositionsPageClient({ initialPositions, departments }: PositionsPageClientProps) {
  const t = useTranslations("Pages.positions")
  const tCommon = useTranslations("Common")
  const [optimisticPositions, dispatchOptimistic] = useOptimistic(initialPositions, reducer)
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Position | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const departmentById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments])

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

  const columns: ColumnDef<Position>[] = [
    { accessorKey: "title", header: t("columnTitle") },
    { accessorKey: "code", header: t("columnCode") },
    {
      id: "department",
      header: t("columnDepartment"),
      cell: ({ row }) => departmentById.get(row.original.departmentId)?.name ?? "—",
    },
    {
      accessorKey: "description",
      header: t("columnDescription"),
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.description || "—"}</span>,
    },
  ]

  function handleArchive(position: Position) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: position.id, active: false })
      const result = await archivePositionAction(position.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleRestore(position: Position) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: position.id, active: true })
      const result = await restorePositionAction(position.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleSubmit(input: PositionInput) {
    setError(null)
    startTransition(async () => {
      const now = new Date()
      const optimisticPosition: Position = editing
        ? { ...editing, ...input, description: input.description ?? null }
        : {
            id: `temp-${Date.now()}`,
            code: (input.code || input.title).toUpperCase(),
            title: input.title,
            departmentId: input.departmentId,
            description: input.description ?? null,
            active: true,
            createdAt: now,
            updatedAt: now,
          }
      dispatchOptimistic({ type: "upsert", position: optimisticPosition })

      const result = editing
        ? await updatePositionAction(editing.id, input)
        : await createPositionAction(input)

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
        records={optimisticPositions}
        columns={columns}
        matchesSearch={(position, query) =>
          position.title.toLowerCase().includes(query) ||
          position.code.toLowerCase().includes(query) ||
          (departmentById.get(position.departmentId)?.name.toLowerCase().includes(query) ?? false)
        }
        labels={labels}
        onNew={() => {
          setEditing(undefined)
          setDialogOpen(true)
        }}
        onEdit={(position) => {
          setEditing(position)
          setDialogOpen(true)
        }}
        onArchive={handleArchive}
        onRestore={handleRestore}
      />
      <PositionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        position={editing}
        departments={departments}
        onSubmit={handleSubmit}
        isSaving={isPending}
      />
    </div>
  )
}
