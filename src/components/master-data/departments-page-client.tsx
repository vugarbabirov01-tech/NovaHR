"use client"

import { useOptimistic, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { MasterDataList, type MasterDataListLabels } from "@/components/master-data/master-data-list"
import { AddDepartmentDialog } from "@/components/master-data/add-department-dialog"
import { ConfirmDeleteDialog } from "@/components/master-data/confirm-delete-dialog"
import {
  archiveDepartmentAction,
  createDepartmentAction,
  deleteDepartmentAction,
  restoreDepartmentAction,
  updateDepartmentAction,
} from "@/app/[locale]/(app)/departments/actions"
import type { Department, DepartmentInput } from "@/repositories/department-repository"

type OptimisticAction =
  | { type: "upsert"; department: Department }
  | { type: "setActive"; id: string; active: boolean }
  | { type: "remove"; id: string }

function reducer(state: Department[], action: OptimisticAction): Department[] {
  switch (action.type) {
    case "upsert": {
      const exists = state.some((d) => d.id === action.department.id)
      return exists
        ? state.map((d) => (d.id === action.department.id ? action.department : d))
        : [...state, action.department]
    }
    case "setActive":
      return state.map((d) => (d.id === action.id ? { ...d, active: action.active } : d))
    case "remove":
      return state.filter((d) => d.id !== action.id)
  }
}

interface DepartmentsPageClientProps {
  initialDepartments: Department[]
}

export function DepartmentsPageClient({ initialDepartments }: DepartmentsPageClientProps) {
  const t = useTranslations("Pages.departments")
  const tCommon = useTranslations("Common")
  const [optimisticDepartments, dispatchOptimistic] = useOptimistic(initialDepartments, reducer)
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Department | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingDepartment, setDeletingDepartment] = useState<Department | undefined>(undefined)
  const [isDeleting, setIsDeleting] = useState(false)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)

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

  const columns: ColumnDef<Department>[] = [
    { accessorKey: "name", header: t("columnName") },
    { accessorKey: "code", header: t("columnCode") },
    {
      accessorKey: "description",
      header: t("columnDescription"),
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.description || "—"}</span>,
    },
  ]

  function handleArchive(department: Department) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: department.id, active: false })
      const result = await archiveDepartmentAction(department.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleRestore(department: Department) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: department.id, active: true })
      const result = await restoreDepartmentAction(department.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleDeleteRequest(department: Department) {
    setBlockedReason(null)
    setDeletingDepartment(department)
    setDeleteDialogOpen(true)
  }

  function handleDeleteConfirm() {
    if (!deletingDepartment) return
    const department = deletingDepartment
    setIsDeleting(true)
    setBlockedReason(null)
    startTransition(async () => {
      const result = await deleteDepartmentAction(department.id)
      setIsDeleting(false)
      if (result.success) {
        dispatchOptimistic({ type: "remove", id: department.id })
        setDeleteDialogOpen(false)
        setDeletingDepartment(undefined)
      } else if (result.error === "in-use") {
        setBlockedReason(
          t("deleteBlocked", {
            name: department.name,
            employeeCount: result.employeeCount ?? 0,
            positionCount: result.positionCount ?? 0,
          })
        )
      } else {
        setBlockedReason(tCommon("genericError"))
      }
    })
  }

  function handleSubmit(input: DepartmentInput) {
    setError(null)
    startTransition(async () => {
      const now = new Date()
      const optimisticDepartment: Department = editing
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
      dispatchOptimistic({ type: "upsert", department: optimisticDepartment })

      const result = editing
        ? await updateDepartmentAction(editing.id, input)
        : await createDepartmentAction(input)

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
        records={optimisticDepartments}
        columns={columns}
        matchesSearch={(department, query) =>
          department.name.toLowerCase().includes(query) || department.code.toLowerCase().includes(query)
        }
        labels={labels}
        onNew={() => {
          setEditing(undefined)
          setDialogOpen(true)
        }}
        onEdit={(department) => {
          setEditing(department)
          setDialogOpen(true)
        }}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onDelete={handleDeleteRequest}
      />
      <AddDepartmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        department={editing}
        onSubmit={handleSubmit}
        isSaving={isPending}
      />
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setDeletingDepartment(undefined)
            setBlockedReason(null)
          }
        }}
        title={t("deleteConfirmTitle")}
        description={
          deletingDepartment ? t("deleteConfirmDescription", { name: deletingDepartment.name }) : ""
        }
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        blockedReason={blockedReason}
      />
    </div>
  )
}
