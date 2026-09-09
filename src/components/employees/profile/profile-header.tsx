"use client"

import { useTranslations } from "next-intl"
import { ArrowLeft, Mail, Pencil, Phone } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { EmploymentStatusBadge } from "@/components/employees/employment-status-badge"
import { WorkStatusBadge } from "@/components/employees/work-status-badge"
import { getFullName, getInitials } from "@/lib/employees"
import { cn } from "@/lib/utils"
import type { WorkStatus } from "@/lib/employee-work-status"
import type { EmployeeProfile } from "@/types/employee-profile"

interface ProfileHeaderProps {
  profile: EmployeeProfile
  /** Resolved once per page load by resolveWorkStatus (see
   * employees/[id]/page.tsx) — this component never computes it itself. */
  workStatus: WorkStatus
  /** The Employees list URL to return to (filters/search/status/view all
   * folded in) — read server-side from this page's own ?returnTo= (see
   * employees/[id]/page.tsx) rather than a client useSearchParams() here,
   * since this page is statically prerendered per employee
   * (generateStaticParams) and useSearchParams would force every one of
   * those pages into a Suspense-wrapped client bailout for a link that's
   * only ever a plain optional string. Already validated server-side —
   * only ever this app's own Employees list, never an arbitrary URL a
   * crafted link could supply (an open-redirect vector otherwise).
   *
   * Also forwarded onto the Edit button as its own ?returnTo= so the whole
   * Profile → Edit → Save → Profile → back-to-list chain keeps the same
   * list URL alive end to end — not just this one List → Profile leg. */
  backHref: string
}

export function ProfileHeader({ profile, workStatus, backHref }: ProfileHeaderProps) {
  const t = useTranslations("Employees.profile")
  const tQuickActions = useTranslations("Employees.quickActions")
  const name = getFullName(profile.personal)

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={backHref}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.75} />
        {t("backToList")}
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage src={profile.personal.photoUrl} alt={name} />
            <AvatarFallback className="bg-accent text-lg text-accent-foreground">
              {getInitials(profile.personal.firstName, profile.personal.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {name}
              </h1>
              <EmploymentStatusBadge status={profile.employmentStatus} />
              <WorkStatusBadge status={workStatus} />
            </div>
            <p className="text-sm text-muted-foreground">
              {profile.employment.position}
              {profile.employment.company ? ` · ${profile.employment.company}` : ""}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {profile.employment.employeeNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/employees/${profile.id}/edit?returnTo=${encodeURIComponent(backHref)}`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Pencil className="size-3.5" strokeWidth={1.75} />
            {tQuickActions("editEmployee")}
          </Link>
          <a
            href={`mailto:${profile.personal.email}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Mail className="size-3.5" strokeWidth={1.75} />
            {profile.personal.email}
          </a>
          <a
            href={`tel:${profile.personal.phone}`}
            className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
            aria-label={profile.personal.phone}
          >
            <Phone className="size-3.5" strokeWidth={1.75} />
          </a>
        </div>
      </div>
    </div>
  )
}
