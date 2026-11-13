"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"

import { createReplacementVacancyAction } from "@/app/[locale]/(app)/recruitment/actions"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { Link, useRouter } from "@/i18n/navigation"
import { formatReportDate } from "@/lib/reports/format-date"

export interface VacantPlaceRow {
  employeeId: string
  fullName: string
  employeeNumber: string
  position: string
  department: string
  /** yyyy-mm-dd, empty when unknown */
  leftOn: string
}

/** Employees who left and whose place has no vacancy yet. */
export function VacantPlaces({ places }: { places: VacantPlaceRow[] }) {
  const t = useTranslations("Recruitment.vacant")
  const tErrors = useTranslations("Recruitment.errors")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)

  if (places.length === 0) return null

  function create(employeeId: string) {
    setActiveId(employeeId)
    startTransition(async () => {
      const result = await createReplacementVacancyAction(employeeId)
      setActiveId(null)
      if (result.success) router.push(`/recruitment/${result.data.id}`)
      else toast.error(tErrors(result.code as never))
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t("title", { count: places.length })}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {places.map((place) => (
          <li
            key={place.employeeId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <div className="flex min-w-0 flex-col">
              <span className="font-medium text-foreground">{place.position || "—"}</span>
              <span className="text-xs text-muted-foreground">
                {[place.department, t("formerHolder", { name: place.fullName })].filter(Boolean).join(" · ")}
                {place.leftOn ? ` · ${t("leftOn", { date: formatReportDate(place.leftOn) })}` : ""}
                {" · "}
                <Link href={`/employees/${place.employeeId}`} className="hover:underline">
                  {place.employeeNumber}
                </Link>
              </span>
            </div>
            <Button size="sm" disabled={pending} onClick={() => create(place.employeeId)}>
              {pending && activeId === place.employeeId ? t("creating") : t("create")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
