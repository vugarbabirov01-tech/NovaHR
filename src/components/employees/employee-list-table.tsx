"use client"

import { useEffect, useMemo, useState } from "react"
import {
  type ColumnDef,
  type ExpandedState,
  type GroupingState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useTranslations } from "next-intl"
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Layers,
  MoreHorizontal,
  Trash2,
  UserCog,
  Users,
} from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/common/empty-state"
import { EmploymentStatusBadge } from "@/components/employees/employment-status-badge"
import { employmentTypeMessageKeys, getFullName, getInitials } from "@/lib/employees"
import type { EmployeeGroupBy } from "@/types/employee-filters"
import type { EmployeeListItem } from "@/types/employee-profile"

interface EmployeeListTableProps {
  data: EmployeeListItem[]
}

const groupColumnIds: Record<Exclude<EmployeeGroupBy, "none">, string> = {
  workLocation: "workLocation",
  department: "department",
  manager: "managerName",
}

export function EmployeeListTable({ data }: EmployeeListTableProps) {
  const t = useTranslations("Employees.table")
  const tType = useTranslations("EmploymentType")
  const tCommon = useTranslations("Employees.card")
  const tList = useTranslations("Employees.list")
  const router = useRouter()

  const groupByLabels: Record<string, string> = {
    none: t("groupByNone"),
    workLocation: t("groupByWorkLocation"),
    department: t("groupByDepartment"),
    manager: t("groupByManager"),
  }

  const columnLabels: Record<string, string> = {
    name: t("columnFullName"),
    finCode: t("columnFin"),
    department: t("columnDepartment"),
    managerName: t("columnManager"),
    workLocation: t("columnWorkLocation"),
    employmentType: t("columnEmploymentType"),
    employmentStatus: t("columnStatus"),
    hireDate: t("columnHireDate"),
  }

  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [groupBy, setGroupBy] = useState<EmployeeGroupBy>("none")
  const [grouping, setGrouping] = useState<GroupingState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})

  function handleGroupByChange(value: EmployeeGroupBy) {
    setGroupBy(value)
    setGrouping(value === "none" ? [] : [groupColumnIds[value]])
    setExpanded({})
  }

  const columns = useMemo<ColumnDef<EmployeeListItem>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(value === true)}
            onClick={(event) => event.stopPropagation()}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        enableGrouping: false,
      },
      {
        id: "name",
        accessorFn: (row) => getFullName(row),
        header: t("columnFullName"),
        enableGrouping: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              <AvatarFallback className="bg-accent text-[11px] text-accent-foreground">
                {getInitials(row.original.firstName, row.original.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{getFullName(row.original)}</span>
              <span className="text-xs text-muted-foreground">{row.original.position}</span>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "finCode",
        header: t("columnFin"),
        enableGrouping: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">{row.original.finCode}</span>
        ),
      },
      {
        accessorKey: "department",
        header: t("columnDepartment"),
      },
      {
        accessorKey: "managerName",
        header: t("columnManager"),
        cell: ({ row }) => row.original.managerName ?? (
          <span className="text-muted-foreground">{tCommon("noManager")}</span>
        ),
      },
      {
        accessorKey: "workLocation",
        header: t("columnWorkLocation"),
      },
      {
        accessorKey: "employmentType",
        header: t("columnEmploymentType"),
        enableGrouping: false,
        cell: ({ row }) => tType(employmentTypeMessageKeys[row.original.employmentType]),
      },
      {
        accessorKey: "employmentStatus",
        header: t("columnStatus"),
        enableGrouping: false,
        cell: ({ row }) => <EmploymentStatusBadge status={row.original.employmentStatus} />,
      },
      {
        accessorKey: "hireDate",
        enableGrouping: false,
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("columnHireDate")}
            <ArrowUpDown className="size-3.5" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.hireDate}</span>
        ),
      },
      {
        id: "actions",
        header: t("columnActions"),
        enableHiding: false,
        enableGrouping: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                render={<Link href={`/employees/${row.original.id}`} />}
              >
                <Users className="size-4" strokeWidth={1.75} />
                {t("viewProfile")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <UserCog className="size-4" strokeWidth={1.75} />
                {t("editEmployee")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, tType, tCommon]
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection, columnVisibility, grouping, expanded, pagination },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  // TanStack's built-in autoResetPageIndex fires synchronously during the
  // table's initial construction (before this component finishes mounting),
  // which React flags as a state update on a not-yet-mounted component.
  // Disabling it above and resetting to page 0 here — after mount, in
  // response to the data actually changing — reproduces the same "jump
  // back to page 1 when the result set changes" behavior safely.
  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }))
  }, [data])

  const isGrouped = grouping.length > 0
  const selectedCount = table.getSelectedRowModel().rows.length
  const visibleRows = isGrouped ? table.getExpandedRowModel().rows : table.getRowModel().rows
  const columnCount = table.getVisibleFlatColumns().length

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={tList("emptyTitle")}
        description={tList("emptyDescription")}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-h-8 flex-wrap items-center gap-2">
          {selectedCount > 0 ? (
            <>
              <span className="text-sm font-medium text-foreground">
                {t("selectedCount", { count: selectedCount })}
              </span>
              <Button variant="outline" size="sm">
                <Download className="size-3.5" strokeWidth={1.75} />
                {t("bulkExport")}
              </Button>
              <Button variant="outline" size="sm">
                <UserCog className="size-3.5" strokeWidth={1.75} />
                {t("bulkChangeStatus")}
              </Button>
              <Button variant="destructive" size="sm">
                <Trash2 className="size-3.5" strokeWidth={1.75} />
                {t("bulkDelete")}
              </Button>
            </>
          ) : (
            <>
              <Layers className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
              <span className="text-sm text-muted-foreground">{t("groupBy")}</span>
              <Select value={groupBy} onValueChange={(v) => handleGroupByChange((v ?? "none") as EmployeeGroupBy)}>
                <SelectTrigger size="sm" className="w-44">
                  <SelectValue>{(value: string) => groupByLabels[value] ?? value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("groupByNone")}</SelectItem>
                  <SelectItem value="workLocation">{t("groupByWorkLocation")}</SelectItem>
                  <SelectItem value="department">{t("groupByDepartment")}</SelectItem>
                  <SelectItem value="manager">{t("groupByManager")}</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Columns3 className="size-3.5" strokeWidth={1.75} />
            {t("columns")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{t("columns")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(value === true)}
                  onClick={(event) => event.preventDefault()}
                >
                  {columnLabels[column.id] ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-10 px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => {
              if (row.getIsGrouped()) {
                const groupLabel = String(row.getValue(row.groupingColumnId ?? "") || "—")
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer bg-muted/40 hover:bg-muted/60"
                    onClick={row.getToggleExpandedHandler()}
                  >
                    <TableCell colSpan={columnCount} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            !row.getIsExpanded() && "-rotate-90"
                          )}
                          aria-label={row.getIsExpanded() ? t("collapseGroup") : t("expandGroup")}
                        />
                        <span className="font-medium text-foreground">{groupLabel}</span>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          ({row.subRows.length})
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              }

              return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => router.push(`/employees/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {cell.getIsPlaceholder()
                        ? null
                        : flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {!isGrouped ? (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t("rowsPerPage")}</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) => {
                setPagination((prev) => ({ ...prev, pageSize: Number(value), pageIndex: 0 }))
              }}
            >
              <SelectTrigger size="sm" className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {t("pageOf", {
                current: table.getState().pagination.pageIndex + 1,
                total: Math.max(table.getPageCount(), 1),
              })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
                aria-label={t("previous")}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
                aria-label={t("next")}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
