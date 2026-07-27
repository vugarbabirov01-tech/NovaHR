"use client"

import { useMemo, useOptimistic, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { MasterDataList, type MasterDataListLabels } from "@/components/master-data/master-data-list"
import { BranchFormDialog } from "@/components/master-data/branch-form-dialog"
import {
  archiveBranchAction,
  createBranchAction,
  restoreBranchAction,
  updateBranchAction,
} from "@/app/[locale]/(app)/branches/actions"
import type { Branch, BranchInput } from "@/repositories/branch-repository"
import type { Company } from "@/repositories/company-repository"

type OptimisticAction =
  | { type: "upsert"; branch: Branch }
  | { type: "setActive"; id: string; active: boolean }

function reducer(state: Branch[], action: OptimisticAction): Branch[] {
  switch (action.type) {
    case "upsert": {
      const exists = state.some((b) => b.id === action.branch.id)
      return exists ? state.map((b) => (b.id === action.branch.id ? action.branch : b)) : [...state, action.branch]
    }
    case "setActive":
      return state.map((b) => (b.id === action.id ? { ...b, active: action.active } : b))
  }
}

interface BranchesPageClientProps {
  initialBranches: Branch[]
  companies: Company[]
}

export function BranchesPageClient({ initialBranches, companies }: BranchesPageClientProps) {
  const t = useTranslations("Pages.branches")
  const tCommon = useTranslations("Common")
  const [optimisticBranches, dispatchOptimistic] = useOptimistic(initialBranches, reducer)
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies])

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

  const columns: ColumnDef<Branch>[] = [
    { accessorKey: "name", header: t("columnName") },
    { accessorKey: "code", header: t("columnCode") },
    {
      id: "company",
      header: t("columnCompany"),
      cell: ({ row }) => companyById.get(row.original.companyId)?.name ?? "—",
    },
  ]

  function handleArchive(branch: Branch) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: branch.id, active: false })
      const result = await archiveBranchAction(branch.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleRestore(branch: Branch) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: branch.id, active: true })
      const result = await restoreBranchAction(branch.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleSubmit(input: BranchInput) {
    setError(null)
    startTransition(async () => {
      const now = new Date()
      const optimisticBranch: Branch = editing
        ? { ...editing, ...input, description: input.description ?? null }
        : {
            id: `temp-${Date.now()}`,
            code: (input.code || input.name).toUpperCase(),
            name: input.name,
            companyId: input.companyId,
            description: input.description ?? null,
            active: true,
            createdAt: now,
            updatedAt: now,
          }
      dispatchOptimistic({ type: "upsert", branch: optimisticBranch })

      const result = editing ? await updateBranchAction(editing.id, input) : await createBranchAction(input)

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
        records={optimisticBranches}
        columns={columns}
        matchesSearch={(branch, query) =>
          branch.name.toLowerCase().includes(query) ||
          branch.code.toLowerCase().includes(query) ||
          (companyById.get(branch.companyId)?.name.toLowerCase().includes(query) ?? false)
        }
        labels={labels}
        onNew={() => {
          setEditing(undefined)
          setDialogOpen(true)
        }}
        onEdit={(branch) => {
          setEditing(branch)
          setDialogOpen(true)
        }}
        onArchive={handleArchive}
        onRestore={handleRestore}
      />
      <BranchFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        branch={editing}
        companies={companies}
        onSubmit={handleSubmit}
        isSaving={isPending}
      />
    </div>
  )
}
