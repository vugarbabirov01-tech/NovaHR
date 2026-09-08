"use client"

import { useMemo, useOptimistic, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { MasterDataList, type MasterDataListLabels } from "@/components/master-data/master-data-list"
import { PositionFormDialog } from "@/components/master-data/position-form-dialog"
import { ConfirmDeleteDialog } from "@/components/master-data/confirm-delete-dialog"
import {
  archivePositionAction,
  createPositionAction,
  deletePositionAction,
  restorePositionAction,
  updatePositionAction,
} from "@/app/[locale]/(app)/positions/actions"
import type { Position, PositionInput } from "@/repositories/position-repository"
import type { Department } from "@/repositories/department-repository"

type OptimisticAction =
  | { type: "upsert"; position: Position }
  | { type: "setActive"; id: string; active: boolean }
  | { type: "remove"; id: string }

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
    case "remove":
      return state.filter((p) => p.id !== action.id)
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingPosition, setDeletingPosition] = useState<Position | undefined>(undefined)
  const [isDeleting, setIsDeleting] = useState(false)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)

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
    delete: tCommon("delete"),
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

  function handleDeleteRequest(position: Position) {
    setBlockedReason(null)
    setDeletingPosition(position)
    setDeleteDialogOpen(true)
  }

  function handleDeleteConfirm() {
    if (!deletingPosition) return
    const position = deletingPosition
    setIsDeleting(true)
    setBlockedReason(null)
    startTransition(async () => {
      const result = await deletePositionAction(position.id)
      setIsDeleting(false)
      if (result.success) {
        dispatchOptimistic({ type: "remove", id: position.id })
        setDeleteDialogOpen(false)
        setDeletingPosition(undefined)
      } else if (result.error === "in-use") {
        setBlockedReason(
          t("deleteBlocked", {
            name: position.title,
            employeeCount: result.employeeCount ?? 0,
          })
        )
      } else {
        setBlockedReason(tCommon("genericError"))
      }
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
        onDelete={handleDeleteRequest}
      />
      <PositionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        position={editing}
        departments={departments}
        onSubmit={handleSubmit}
        isSaving={isPending}
      />
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setDeletingPosition(undefined)
            setBlockedReason(null)
          }
        }}
        title={t("deleteConfirmTitle")}
        description={deletingPosition ? t("deleteConfirmDescription", { name: deletingPosition.title }) : ""}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        blockedReason={blockedReason}
      />
    </div>
  )
}
