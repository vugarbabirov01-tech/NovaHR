"use client"

import { useTranslations } from "next-intl"
import { Gavel, TriangleAlert } from "lucide-react"

import { cn, formatShortDate } from "@/lib/utils"
import { isPenalty, type ActivePenalty } from "@/lib/discipline/discipline-rules"

interface DisciplineNoticeProps {
  penalty?: ActivePenalty
  /** Icon only (list rows). Either way the full text is in the tooltip. */
  compact?: boolean
  className?: string
}

/**
 * Flags a disciplinary penalty while it is in force, or a recent written warning
 * (amber; penalties are red). Shows only the type (the last day is in the
 * tooltip), never the reason, and is left out of printouts.
 */
export function DisciplineNotice({ penalty, compact, className }: DisciplineNoticeProps) {
  const t = useTranslations("Employees.profile.discipline")
  const tCommon = useTranslations("Common")

  // A cached page may outlive the penalty: check the date where it is displayed too.
  if (!penalty || new Date().toISOString().slice(0, 10) > penalty.until) return null

  const warning = !isPenalty(penalty.type)
  const text = t(warning ? "warningNotice" : "notice", {
    type: t(`types.${penalty.type}` as never),
    date: formatShortDate(new Date(penalty.until), tCommon.raw("monthsShort") as string[]),
  })
  const label = t(`shortTypes.${penalty.type}` as never)
  const Icon = warning ? TriangleAlert : Gavel

  return (
    <span
      title={text}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-full text-[11px] leading-4 font-medium print:hidden",
        warning
          ? "bg-amber-400/25 text-amber-800 dark:text-amber-300"
          : "bg-red-500/15 text-red-700 dark:text-red-300",
        compact ? "p-1" : "px-1.5 py-0.5",
        className
      )}
    >
      <Icon className="size-3 shrink-0" strokeWidth={2} aria-hidden />
      {compact ? null : <span aria-hidden>{label}</span>}
      <span className="sr-only">{text}</span>
    </span>
  )
}
