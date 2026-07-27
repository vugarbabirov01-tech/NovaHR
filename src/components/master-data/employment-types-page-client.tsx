"use client"

import { useOptimistic, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { MasterDataList, type MasterDataListLabels } from "@/components/master-data/master-data-list"
import { EmploymentTypeFormDialog } from "@/components/master-data/employment-type-form-dialog"
import {
  archiveEmploymentTypeAction,
  createEmploymentTypeAction,
  restoreEmploymentTypeAction,
  updateEmploymentTypeAction,
} from "@/app/[locale]/(app)/employment-types/actions"
import type { EmploymentType, EmploymentTypeInput } from "@/repositories/employment-type-repository"

type OptimisticAction =
  | { type: "upsert"; employmentType: EmploymentType }
  | { type: "setActive"; id: string; active: boolean }

function reducer(state: EmploymentType[], action: OptimisticAction): EmploymentType[] {
  switch (action.type) {
    case "upsert": {
      const exists = state.some((e) => e.id === action.employmentType.id)
      return exists
        ? state.map((e) => (e.id === action.employmentType.id ? action.employmentType : e))
        : [...state, action.employmentType]
    }
    case "setActive":
      return state.map((e) => (e.id === action.id ? { ...e, active: action.active } : e))
  }
}

interface EmploymentTypesPageClientProps {
  initialEmploymentTypes: EmploymentType[]
}

export function EmploymentTypesPageClient({ initialEmploymentTypes }: EmploymentTypesPageClientProps) {
  const t = useTranslations("Pages.employmentTypes")
  const tCommon = useTranslations("Common")
  const [optimisticEmploymentTypes, dispatchOptimistic] = useOptimistic(initialEmploymentTypes, reducer)
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EmploymentType | undefined>(undefined)
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

  const columns: ColumnDef<EmploymentType>[] = [
    { accessorKey: "name", header: t("columnName") },
    { accessorKey: "code", header: t("columnCode") },
    {
      accessorKey: "description",
      header: t("columnDescription"),
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.description || "—"}</span>,
    },
  ]

  function handleArchive(employmentType: EmploymentType) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: employmentType.id, active: false })
      const result = await archiveEmploymentTypeAction(employmentType.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleRestore(employmentType: EmploymentType) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: employmentType.id, active: true })
      const result = await restoreEmploymentTypeAction(employmentType.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleSubmit(input: EmploymentTypeInput) {
    setError(null)
    startTransition(async () => {
      const now = new Date()
      const optimisticEmploymentType: EmploymentType = editing
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
      dispatchOptimistic({ type: "upsert", employmentType: optimisticEmploymentType })

      const result = editing
        ? await updateEmploymentTypeAction(editing.id, input)
        : await createEmploymentTypeAction(input)

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
        records={optimisticEmploymentTypes}
        columns={columns}
        matchesSearch={(employmentType, query) =>
          employmentType.name.toLowerCase().includes(query) || employmentType.code.toLowerCase().includes(query)
        }
        labels={labels}
        onNew={() => {
          setEditing(undefined)
          setDialogOpen(true)
        }}
        onEdit={(employmentType) => {
          setEditing(employmentType)
          setDialogOpen(true)
        }}
        onArchive={handleArchive}
        onRestore={handleRestore}
      />
      <EmploymentTypeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employmentType={editing}
        onSubmit={handleSubmit}
        isSaving={isPending}
      />
    </div>
  )
}
