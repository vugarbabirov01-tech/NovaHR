"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  CalendarDays,
  Eye,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Printer,
  UserX,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

/**
 * Minimal shape the quick-actions menu needs — accepts a full
 * EmployeeListItem/EmployeeProfile or any object with these fields.
 */
export interface EmployeeQuickActionsTarget {
  id: string
  fullName: string
}

interface EmployeeQuickActionsProps {
  employee: EmployeeQuickActionsTarget
  align?: "start" | "end"
  className?: string
}

interface QuickAction {
  key: string
  icon: LucideIcon
  label: string
  href?: string
  onSelect?: () => void
}

export function EmployeeQuickActions({
  employee,
  align = "end",
  className,
}: EmployeeQuickActionsProps) {
  const t = useTranslations("Employees.quickActions")
  const isMobile = useMediaQuery("(max-width: 767px)")
  const [menuOpen, setMenuOpen] = useState(false)

  const actions: QuickAction[] = [
    {
      key: "viewProfile",
      icon: Eye,
      label: t("viewProfile"),
      href: `/employees/${employee.id}`,
    },
    {
      key: "editEmployee",
      icon: Pencil,
      label: t("editEmployee"),
      href: `/employees/${employee.id}/edit`,
    },
    {
      // No standalone Leave module exists yet, so this deep-links into the
      // employee's own profile — Leave Information tab, the closest thing
      // to a real, working Leave destination in the app today.
      key: "assignLeave",
      icon: CalendarDays,
      label: t("assignLeave"),
      href: `/employees/${employee.id}?tab=leave`,
    },
    {
      // No standalone Contract module exists either. "contract" is already
      // a real DocumentCategory, so this opens Documents scoped to it —
      // the upload dropzone there doubles as the "create contract" action
      // when none exists yet.
      key: "employmentContract",
      icon: FileText,
      label: t("employmentContract"),
      href: `/employees/${employee.id}?tab=documents&category=contract`,
    },
    {
      key: "payroll",
      icon: Wallet,
      label: t("payroll"),
      href: `/employees/${employee.id}?tab=payroll`,
    },
    {
      key: "documents",
      icon: FolderOpen,
      label: t("documents"),
      href: `/employees/${employee.id}?tab=documents`,
    },
    {
      // A dedicated route so only this employee's card ends up in the
      // print target, not the whole grid — see /employees/[id]/print.
      key: "print",
      icon: Printer,
      label: t("printCard"),
      href: `/employees/${employee.id}/print`,
    },
  ]

  const terminationHref = `/employees/${employee.id}/termination`

  return (
    <>
      {isMobile ? (
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon-sm" className={className} />
            }
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">{t("triggerLabel")}</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SheetHeader className="pb-2">
              <SheetTitle>{t("mobileTitle")}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-0.5 px-2">
              {actions.map((action) => (
                <QuickActionRow key={action.key} action={action} />
              ))}
            </div>
            <div className="mx-4 my-1 h-px bg-border" />
            <div className="px-4 pt-1 pb-1 text-xs font-medium text-muted-foreground">
              {t("dangerZone")}
            </div>
            <div className="px-2 pb-2">
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    href={terminationHref}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive outline-none hover:bg-destructive/10 focus-visible:bg-destructive/10"
                  />
                }
              >
                <UserX className="size-4 shrink-0" strokeWidth={1.75} />
                {t("terminateEmployment")}
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" className={className} />}
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">{t("triggerLabel")}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={align} className="w-56">
            {actions.map((action) =>
              action.href ? (
                <DropdownMenuItem key={action.key} render={<Link href={action.href} />}>
                  <action.icon strokeWidth={1.75} />
                  {action.label}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={action.key} onClick={action.onSelect}>
                  <action.icon strokeWidth={1.75} />
                  {action.label}
                </DropdownMenuItem>
              )
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("dangerZone")}</DropdownMenuLabel>
            <DropdownMenuItem variant="destructive" render={<Link href={terminationHref} />}>
              <UserX strokeWidth={1.75} />
              {t("terminateEmployment")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  )
}

function QuickActionRow({ action }: { action: QuickAction }) {
  const rowClassName = cn(
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground outline-none hover:bg-accent focus-visible:bg-accent"
  )

  if (action.href) {
    return (
      <SheetClose
        nativeButton={false}
        render={<Link href={action.href} className={rowClassName} />}
      >
        <action.icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        {action.label}
      </SheetClose>
    )
  }

  return (
    <SheetClose
      render={<button type="button" onClick={action.onSelect} className={rowClassName} />}
    >
      <action.icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      {action.label}
    </SheetClose>
  )
}
