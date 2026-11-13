"use client"

import { useTranslations } from "next-intl"

import { Link, usePathname } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

/** Section switcher shared by the Recruitment pages. */
export function RecruitmentTabs() {
  const t = useTranslations("Recruitment.tabs")
  const pathname = usePathname()
  const onCandidates = pathname.startsWith("/recruitment/candidates")

  const items = [
    { href: "/recruitment", label: t("vacancies"), active: !onCandidates },
    { href: "/recruitment/candidates", label: t("candidates"), active: onCandidates },
  ]

  return (
    <div className="flex gap-1 border-b border-border">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            item.active
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  )
}
