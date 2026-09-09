"use client"

import { useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PreviewCard, PreviewCardContent, PreviewCardTrigger } from "@/components/ui/preview-card"
import { getFullName, getInitials } from "@/lib/employees"

interface EmployeeAvatarPreviewProps {
  employee: {
    photoUrl?: string
    firstName: string
    lastName: string
    position?: string
  }
  /** Passed straight through to Avatar/AvatarFallback — callers keep their
   * exact existing avatar size/classes; this component only ever adds the
   * hover trigger around it, never changes how big it renders. */
  avatarSize?: "default" | "sm" | "lg" | "xl"
  avatarClassName?: string
  fallbackClassName?: string
}

/**
 * The small avatar on Employee Card / the list table, with a large hover
 * preview of the same photo (Base UI's PreviewCard — see
 * src/components/ui/preview-card.tsx). Whether hovering can open anything
 * at all is gated by the exact same <AvatarImage> this component already
 * renders for the small avatar: its onLoadingStatusChange is Base UI
 * Avatar's own real load/error signal, not a guess from whether photoUrl is
 * a non-empty string — so a broken URL, employee with no photo, or an
 * initials-only fallback never opens an empty/broken preview. The trigger
 * always wraps the avatar (photoUrl's presence never changes mid-page for a
 * given employee here), so there's no structural remount — no flicker.
 */
export function EmployeeAvatarPreview({
  employee,
  avatarSize,
  avatarClassName,
  fallbackClassName,
}: EmployeeAvatarPreviewProps) {
  const [loaded, setLoaded] = useState(false)
  const fullName = getFullName(employee)

  const avatar = (
    <Avatar size={avatarSize} className={avatarClassName}>
      <AvatarImage
        src={employee.photoUrl}
        alt={fullName}
        onLoadingStatusChange={(status) => setLoaded(status === "loaded")}
      />
      <AvatarFallback className={fallbackClassName}>
        {getInitials(employee.firstName, employee.lastName)}
      </AvatarFallback>
    </Avatar>
  )

  if (!employee.photoUrl) return avatar

  return (
    <PreviewCard>
      {/* inline-flex, not display:contents — a `contents` element generates
       * no box of its own, so getBoundingClientRect() on it is degenerate
       * and Floating UI has nothing real to anchor against (this was the
       * actual bug: the preview fell back to the viewport's top-left corner
       * instead of the avatar). inline-flex shrink-wraps tightly around the
       * avatar with zero extra size — same anchoring approach already used
       * for e.g. DropdownMenuTrigger's own `render` overrides in this
       * codebase. Still a <span>, not PreviewCardTrigger's default <a>, so
       * it stays valid nested inside EmployeeCard's own <Link>. */}
      <PreviewCardTrigger delay={200} closeDelay={120} render={<span className="inline-flex" />}>
        {avatar}
      </PreviewCardTrigger>
      {loaded ? (
        <PreviewCardContent
          side="right"
          align="center"
          sideOffset={10}
          className="flex w-[280px] flex-col items-center gap-2 p-2"
        >
          <img
            src={employee.photoUrl}
            alt={fullName}
            className="max-h-[320px] w-full rounded-lg bg-muted object-contain"
          />
          <div className="flex flex-col items-center gap-0.5 px-1 pb-1 text-center">
            <span className="text-sm font-medium text-foreground">{fullName}</span>
            {employee.position ? (
              <span className="text-xs text-muted-foreground">{employee.position}</span>
            ) : null}
          </div>
        </PreviewCardContent>
      ) : null}
    </PreviewCard>
  )
}
