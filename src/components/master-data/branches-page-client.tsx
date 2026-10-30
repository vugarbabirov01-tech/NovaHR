"use client"

import { useMemo, useOptimistic, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { MasterDataList, type MasterDataListLabels } from "@/components/master-data/master-data-list"
import { BranchFormDialog } from "@/components/master-data/branch-form-dialog"
import { ConfirmDeleteDialog } from "@/components/master-data/confirm-delete-dialog"
import {
  archiveBranchAction,
  createBranchAction,
  deleteBranchAction,
  restoreBranchAction,
  updateBranchAction,
} from "@/app/[locale]/(app)/branches/actions"
import type { Branch, BranchInput } from "@/repositories/branch-repository"
import type { Company } from "@/repositories/company-repository"

type OptimisticAction =
  | { type: "upsert"; branch: Branch }
  | { type: "setActive"; id: string; active: boolean }
  | { type: "remove"; id: string }

function reducer(state: Branch[], action: OptimisticAction): Branch[] {
  switch (action.type) {
    case "upsert": {
      const exists = state.some((b) => b.id === action.branch.id)
      return exists ? state.map((b) => (b.id === action.branch.id ? action.branch : b)) : [...state, action.branch]
    }
    case "setActive":
      return state.map((b) => (b.id === action.id ? { ...b, active: action.active } : b))
    case "remove":
      return state.filter((b) => b.id !== action.id)
  }
}

interface BranchesPageClientProps {
  initialBranches: Branch[]
  companies: Company[]
  /** branchId -> how many real employees are currently assigned to it
   * (employment.branchId), computed server-side in page.tsx from the same
   * live roster the rest of the app reads. Zero/missing entries show "0",
   * never "—", so an empty branch reads as empty rather than unknown. */
  employeeCountByBranchId: Record<string, number>
}

/**
 * §7 of the İş Yeri/Filial unification — Name and Employee Count are both
 * links into the Employees list pre-filtered to this branch, reusing the
 * exact same `workLocation` URL param employee-filters-url.ts already
 * serializes (EmployeeListItem.workLocation resolves to the live branch
 * name once an employee has a branchId — see toListItem's own doc comment —
 * so filtering Employees by that exact name is already "show me this
 * branch's people," no new filter plumbing needed).
 */
export function BranchesPageClient({ initialBranches, companies, employeeCountByBranchId }: BranchesPageClientProps) {
  const t = useTranslations("Pages.branches")
  const tCommon = useTranslations("Common")
  const [optimisticBranches, dispatchOptimistic] = useOptimistic(initialBranches, reducer)
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingBranch, setDeletingBranch] = useState<Branch | undefined>(undefined)
  const [isDeleting, setIsDeleting] = useState(false)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)

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
    delete: tCommon("delete"),
    emptyTitle: t("emptyTitle"),
    emptyDescription: t("emptyDescription"),
  }

  const columns: ColumnDef<Branch>[] = [
    {
      accessorKey: "name",
      header: t("columnName"),
      cell: ({ row }) => (
        <Link
          href={`/employees?workLocation=${encodeURIComponent(row.original.name)}`}
          className="font-medium text-foreground hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: "code", header: t("columnCode") },
    {
      id: "company",
      header: t("columnCompany"),
      cell: ({ row }) => companyById.get(row.original.companyId)?.name ?? "—",
    },
    {
      id: "employeeCount",
      header: t("columnEmployeeCount"),
      cell: ({ row }) => (
        <Link href={`/employees?workLocation=${encodeURIComponent(row.original.name)}`}>
          <Badge variant="secondary" className="tabular-nums hover:bg-accent">
            {employeeCountByBranchId[row.original.id] ?? 0}
          </Badge>
        </Link>
      ),
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

  function handleDeleteRequest(branch: Branch) {
    setBlockedReason(null)
    setDeletingBranch(branch)
    setDeleteDialogOpen(true)
  }

  function handleDeleteConfirm() {
    if (!deletingBranch) return
    const branch = deletingBranch
    setIsDeleting(true)
    setBlockedReason(null)
    startTransition(async () => {
      const result = await deleteBranchAction(branch.id)
      setIsDeleting(false)
      if (result.success) {
        dispatchOptimistic({ type: "remove", id: branch.id })
        setDeleteDialogOpen(false)
        setDeletingBranch(undefined)
      } else if (result.error === "in-use") {
        setBlockedReason(t("deleteBlocked", { name: branch.name, employeeCount: result.employeeCount ?? 0 }))
      } else {
        setBlockedReason(tCommon("genericError"))
      }
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
        onDelete={handleDeleteRequest}
      />
      <BranchFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        branch={editing}
        companies={companies}
        onSubmit={handleSubmit}
        isSaving={isPending}
      />
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setDeletingBranch(undefined)
            setBlockedReason(null)
          }
        }}
        title={t("deleteConfirmTitle")}
        description={deletingBranch ? t("deleteConfirmDescription", { name: deletingBranch.name }) : ""}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        blockedReason={blockedReason}
      />
    </div>
  )
}
