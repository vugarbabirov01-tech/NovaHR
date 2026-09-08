"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SearchInput } from "@/components/common/search-input"
import { DataTable } from "@/components/common/data-table"

interface MasterDataRow {
  id: string
  active: boolean
}

export interface MasterDataListLabels {
  searchPlaceholder: string
  active: string
  archived: string
  statusColumn: string
  actionsColumn: string
  newButton: string
  edit: string
  archive: string
  restore: string
  /** Only required when onDelete is provided — see MasterDataListProps. */
  delete?: string
  emptyTitle: string
  emptyDescription: string
}

interface MasterDataListProps<T extends MasterDataRow> {
  records: T[]
  columns: ColumnDef<T>[]
  matchesSearch: (record: T, query: string) => boolean
  labels: MasterDataListLabels
  onNew: () => void
  onEdit: (record: T) => void
  onArchive: (record: T) => void
  onRestore: (record: T) => void
  /**
   * Optional — most master-data screens don't offer permanent delete yet.
   * Only shown for archived records (delete is a step past archive, never
   * a shortcut around it), and only when provided at all, so consumers that
   * don't wire it up (Companies, Grades, ...) keep their exact current menu.
   */
  onDelete?: (record: T) => void
}

export function MasterDataList<T extends MasterDataRow>({
  records,
  columns,
  matchesSearch,
  labels,
  onNew,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: MasterDataListProps<T>) {
  const [tab, setTab] = useState<"active" | "archived">("active")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const byStatus = records.filter((record) => (tab === "active" ? record.active : !record.active))
    const query = search.trim().toLowerCase()
    if (!query) return byStatus
    return byStatus.filter((record) => matchesSearch(record, query))
  }, [records, tab, search, matchesSearch])

  const fullColumns = useMemo<ColumnDef<T>[]>(
    () => [
      ...columns,
      {
        id: "status",
        header: labels.statusColumn,
        cell: ({ row }) => (
          <Badge variant={row.original.active ? "default" : "outline"}>
            {row.original.active ? labels.active : labels.archived}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: labels.actionsColumn,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <Pencil className="size-4" strokeWidth={1.75} />
                {labels.edit}
              </DropdownMenuItem>
              {row.original.active ? (
                <DropdownMenuItem variant="destructive" onClick={() => onArchive(row.original)}>
                  <Archive className="size-4" strokeWidth={1.75} />
                  {labels.archive}
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => onRestore(row.original)}>
                    <ArchiveRestore className="size-4" strokeWidth={1.75} />
                    {labels.restore}
                  </DropdownMenuItem>
                  {onDelete ? (
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(row.original)}>
                      <Trash2 className="size-4" strokeWidth={1.75} />
                      {labels.delete}
                    </DropdownMenuItem>
                  ) : null}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [columns, labels, onEdit, onArchive, onRestore, onDelete]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <SearchInput
            placeholder={labels.searchPlaceholder}
            containerClassName="w-full sm:max-w-xs"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Tabs value={tab} onValueChange={(value) => setTab(value === "archived" ? "archived" : "active")}>
            <TabsList variant="line">
              <TabsTrigger value="active">{labels.active}</TabsTrigger>
              <TabsTrigger value="archived">{labels.archived}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Button size="sm" onClick={onNew}>
          <Plus className="size-3.5" strokeWidth={1.75} />
          {labels.newButton}
        </Button>
      </div>

      <DataTable
        columns={fullColumns}
        data={filtered}
        emptyTitle={labels.emptyTitle}
        emptyDescription={labels.emptyDescription}
      />
    </div>
  )
}
