import { Building } from "lucide-react"
import { getFormatter, getTranslations } from "next-intl/server"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/common/empty-state"
import type { WorkLocationHeadcount } from "@/lib/dashboard-service"

interface WorkLocationHeadcountTableProps {
  data: WorkLocationHeadcount[]
}

/**
 * "Obyektlər üzrə Əməkdaş Sayı" — a compact, scrollable two-column table
 * (never a chart/KPI card, per the request), capped at ~300px tall so a
 * long site list never pushes the rest of the Dashboard down. Same icon as
 * Global Search's own "Work Locations" category (src/components/layout/
 * global-search.tsx) for consistency — workLocation has no master-data
 * table of its own, same as there.
 */
export async function WorkLocationHeadcountTable({ data }: WorkLocationHeadcountTableProps) {
  const t = await getTranslations("Dashboard.workLocationHeadcount")
  const format = await getFormatter()
  const total = data.reduce((sum, row) => sum + row.employees, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState icon={Building} title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 px-3 text-xs">{t("columnLocation")}</TableHead>
                  <TableHead className="h-9 px-3 text-right text-xs">{t("columnCount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.workLocation}>
                    <TableCell className="px-3 py-1.5">{row.workLocation}</TableCell>
                    <TableCell className="px-3 py-1.5 text-right tabular-nums">
                      {format.number(row.employees)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="px-3 py-1.5">{t("totalLabel")}</TableCell>
                  <TableCell className="px-3 py-1.5 text-right tabular-nums">{format.number(total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
