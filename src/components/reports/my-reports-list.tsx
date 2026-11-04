"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { FileBarChart } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfirmDeleteDialog } from "@/components/master-data/confirm-delete-dialog"
import { toast } from "@/components/ui/toast"
import { deleteReportAction } from "@/app/[locale]/(app)/reports/actions"
import type { ReportDefinition } from "@/repositories/report-definition-repository"

interface MyReportsListProps {
  reports: ReportDefinition[]
}

export function MyReportsList({ reports }: MyReportsListProps) {
  const t = useTranslations("Reports.overview")
  const [pendingDelete, setPendingDelete] = useState<ReportDefinition | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirmDelete() {
    if (!pendingDelete) return
    const target = pendingDelete
    startTransition(async () => {
      const result = await deleteReportAction(target.id)
      if (result.success) {
        toast.success(t("deleteSuccess"))
        setPendingDelete(null)
      } else {
        toast.error(result.error ?? t("deleteError"))
      }
    })
  }

  if (reports.length === 0) {
    return <EmptyState icon={FileBarChart} title={t("emptyTitle")} description={t("emptyDescription")} />
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("columnName")}
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("columnDescription")}
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("columnUpdatedAt")}
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">
                {t("columnActions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="px-4 py-3 font-medium">{report.name}</TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">{report.description || "—"}</TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground tabular-nums">
                  {new Date(report.updatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/reports/builder/${report.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      {t("open")}
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => setPendingDelete(report)}>
                      {t("delete")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", { name: pendingDelete?.name ?? "" })}
        onConfirm={handleConfirmDelete}
        isDeleting={isPending}
      />
    </>
  )
}
