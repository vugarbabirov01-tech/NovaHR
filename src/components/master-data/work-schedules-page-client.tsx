"use client"

import { useOptimistic, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { MasterDataList, type MasterDataListLabels } from "@/components/master-data/master-data-list"
import { WorkScheduleFormDialog } from "@/components/master-data/work-schedule-form-dialog"
import {
  archiveWorkScheduleAction,
  createWorkScheduleAction,
  restoreWorkScheduleAction,
  updateWorkScheduleAction,
} from "@/app/[locale]/(app)/work-schedules/actions"
import type { WorkSchedule, WorkScheduleInput } from "@/repositories/work-schedule-repository"

type OptimisticAction =
  | { type: "upsert"; schedule: WorkSchedule }
  | { type: "setActive"; id: string; active: boolean }

function reducer(state: WorkSchedule[], action: OptimisticAction): WorkSchedule[] {
  switch (action.type) {
    case "upsert": {
      const exists = state.some((s) => s.id === action.schedule.id)
      return exists
        ? state.map((s) => (s.id === action.schedule.id ? action.schedule : s))
        : [...state, action.schedule]
    }
    case "setActive":
      return state.map((s) => (s.id === action.id ? { ...s, active: action.active } : s))
  }
}

interface WorkSchedulesPageClientProps {
  initialSchedules: WorkSchedule[]
}

export function WorkSchedulesPageClient({ initialSchedules }: WorkSchedulesPageClientProps) {
  const t = useTranslations("Pages.workSchedules")
  const tCommon = useTranslations("Common")
  const [optimisticSchedules, dispatchOptimistic] = useOptimistic(initialSchedules, reducer)
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WorkSchedule | undefined>(undefined)
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

  const columns: ColumnDef<WorkSchedule>[] = [
    { accessorKey: "label", header: t("columnLabel") },
    { accessorKey: "code", header: t("columnCode") },
    {
      accessorKey: "description",
      header: t("columnDescription"),
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.description || "—"}</span>,
    },
  ]

  function handleArchive(schedule: WorkSchedule) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: schedule.id, active: false })
      const result = await archiveWorkScheduleAction(schedule.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleRestore(schedule: WorkSchedule) {
    setError(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "setActive", id: schedule.id, active: true })
      const result = await restoreWorkScheduleAction(schedule.id)
      if (!result.success) setError(result.error ?? tCommon("genericError"))
    })
  }

  function handleSubmit(input: WorkScheduleInput) {
    setError(null)
    startTransition(async () => {
      const now = new Date()
      const optimisticSchedule: WorkSchedule = editing
        ? { ...editing, ...input, description: input.description ?? null }
        : {
            id: `temp-${Date.now()}`,
            code: (input.code || input.label).toUpperCase(),
            label: input.label,
            description: input.description ?? null,
            active: true,
            createdAt: now,
            updatedAt: now,
            scheduleType: input.scheduleType ?? "WEEKLY",
            workingDays: input.workingDays ?? "MON,TUE,WED,THU,FRI",
            rotationOnDays: input.rotationOnDays ?? null,
            rotationOffDays: input.rotationOffDays ?? null,
            rotationStartDate: input.rotationStartDate ?? null,
          }
      dispatchOptimistic({ type: "upsert", schedule: optimisticSchedule })

      const result = editing
        ? await updateWorkScheduleAction(editing.id, input)
        : await createWorkScheduleAction(input)

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
        records={optimisticSchedules}
        columns={columns}
        matchesSearch={(schedule, query) =>
          schedule.label.toLowerCase().includes(query) || schedule.code.toLowerCase().includes(query)
        }
        labels={labels}
        onNew={() => {
          setEditing(undefined)
          setDialogOpen(true)
        }}
        onEdit={(schedule) => {
          setEditing(schedule)
          setDialogOpen(true)
        }}
        onArchive={handleArchive}
        onRestore={handleRestore}
      />
      <WorkScheduleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        schedule={editing}
        onSubmit={handleSubmit}
        isSaving={isPending}
      />
    </div>
  )
}
