"use client"

import { useTranslations } from "next-intl"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ReferenceDataCreationSummary } from "@/lib/employee-import/reference-data-auto-resolver"

interface ReferenceDataSummaryProps {
  created: ReferenceDataCreationSummary
}

/**
 * §16/§17 — "NEW DATA TO BE CREATED", shown once auto-resolve
 * (reference-data-auto-resolver.ts, run between Mapping and Validate) has
 * already created these rows for real. Named lists, not just counts, so
 * the user can actually see "Bakı Abadlıq Xidməti" before committing to
 * the rest of the import — nothing here is undoable by leaving Preview,
 * since the create already happened, but seeing it building trust in what
 * just ran automatically is the point.
 */
export function ReferenceDataSummary({ created }: ReferenceDataSummaryProps) {
  const t = useTranslations("Employees.import.preview.referenceData")

  const groups: { key: keyof ReferenceDataCreationSummary; label: string }[] = [
    { key: "companies", label: t("companies") },
    { key: "departments", label: t("departments") },
    { key: "positions", label: t("positions") },
  ]

  const totalCreated = groups.reduce((sum, g) => sum + created[g.key].length, 0)
  if (totalCreated === 0) return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h4 className="font-heading text-sm font-semibold text-foreground">{t("title")}</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {groups
            .filter((g) => created[g.key].length > 0)
            .map((g) => (
              <div key={g.key} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{g.label}</span>
                  <Badge variant="secondary" className="tabular-nums">
                    {t("willCreate", { count: created[g.key].length })}
                  </Badge>
                </div>
                <ul className="flex flex-col gap-0.5">
                  {created[g.key].map((name) => (
                    <li key={name} className="truncate text-sm text-foreground">
                      + {name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("note")}</p>
      </CardContent>
    </Card>
  )
}
