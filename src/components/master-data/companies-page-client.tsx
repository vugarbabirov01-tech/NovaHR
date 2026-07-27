"use client"

import { useOptimistic, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { MasterDataList, type MasterDataListLabels } from "@/components/master-data/master-data-list"
import { CompanyFormDialog } from "@/components/master-data/company-form-dialog"
import {
  archiveCompanyAction,
  createCompanyAction,
  restoreCompanyAction,
  updateCompanyAction,
} from "@/app/[locale]/(app)/companies/actions"
import type { Company, CompanyInput } from "@/repositories/company-repository"

type OptimisticAction =
  | { type: "upsert"; company: Company }
  | { type: "setActive"; id: string; active: boolean }

function reducer(state: Company[], action: OptimisticAction): Company[] {
  switch (action.type) {
    case "upsert": {
      const exists = state.some((c) => c.id === action.company.id)
      return exists
        ? state.map((c) => (c.id === action.company.id ? action.company : c))
        : [...state, action.company]
    }
    case "setActive":
      return state.map((c) => (c.id === action.id ? { ...c, active: action.active } : c))
  }
}

interface CompaniesPageClientProps {
  initialCompanies: Company[]
}

export function CompaniesPageClient({ initialCompanies }: CompaniesPageClientProps) {
  const t = useTranslations("Pages.companies")
  const tCommon = useTranslations("Common")
  const [optimisticCompanies, dispatchOptimistic] = useOptimistic(initialCompanies, reducer)
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Company | undefined>(undefined)
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

  const columns: ColumnDef<Company>[] = [
    { accessorKey: "name", header: t("columnName") },
    { accessorKey: "code", header: t("columnCode") },
    {
      accessorKey: "description",
      header: t("columnDescription"),
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.description || "—"}</span>,
    },
  ]

  function handleArchive(company: Company) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: company.id, active: false })
      const result = await archiveCompanyAction(company.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleRestore(company: Company) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: company.id, active: true })
      const result = await restoreCompanyAction(company.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleSubmit(input: CompanyInput) {
    setError(null)
    startTransition(async () => {
      const now = new Date()
      const optimisticCompany: Company = editing
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
      dispatchOptimistic({ type: "upsert", company: optimisticCompany })

      const result = editing
        ? await updateCompanyAction(editing.id, input)
        : await createCompanyAction(input)

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
        records={optimisticCompanies}
        columns={columns}
        matchesSearch={(company, query) =>
          company.name.toLowerCase().includes(query) || company.code.toLowerCase().includes(query)
        }
        labels={labels}
        onNew={() => {
          setEditing(undefined)
          setDialogOpen(true)
        }}
        onEdit={(company) => {
          setEditing(company)
          setDialogOpen(true)
        }}
        onArchive={handleArchive}
        onRestore={handleRestore}
      />
      <CompanyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        company={editing}
        onSubmit={handleSubmit}
        isSaving={isPending}
      />
    </div>
  )
}
