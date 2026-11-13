import { getTranslations } from "next-intl/server"
import { Building2, CalendarDays, Clock, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { REPORT_TEMPLATES, REPORT_TEMPLATE_CATEGORIES, type ReportTemplateCategory } from "@/lib/reports/report-templates"

const CATEGORY_ICONS: Record<ReportTemplateCategory, LucideIcon> = {
  employees: Users,
  tenure: Clock,
  leave: CalendarDays,
  organization: Building2,
}

/**
 * Ready-made reports, grouped by theme. Each card opens the builder
 * pre-filled with that recipe (see report-templates.ts) — the user runs it
 * as-is or adjusts it, and saving creates their own copy.
 */
export async function ReportTemplateGallery() {
  const t = await getTranslations("Reports.overview")
  const tTemplates = await getTranslations("Reports.templates")
  const tCategories = await getTranslations("Reports.templateCategories")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-foreground">{t("readyReportsTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("readyReportsDescription")}</p>
      </div>
      {REPORT_TEMPLATE_CATEGORIES.map((category) => {
        const templates = REPORT_TEMPLATES.filter((template) => template.category === category)
        if (templates.length === 0) return null
        const Icon = CATEGORY_ICONS[category]
        return (
          <section key={category} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <Icon className="size-3.5" strokeWidth={1.75} />
              {tCategories(category)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => (
                <Link
                  key={template.id}
                  href={`/reports/builder?template=${template.id}`}
                  className="flex flex-col gap-1 rounded-xl border border-border p-4 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="text-sm font-medium text-foreground">{tTemplates(`${template.id}.name`)}</span>
                  <span className="text-xs text-muted-foreground">{tTemplates(`${template.id}.description`)}</span>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
