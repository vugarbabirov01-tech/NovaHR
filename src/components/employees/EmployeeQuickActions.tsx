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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

/**
 * Optional callbacks for the not-yet-implemented modules. Each is a no-op
 * placeholder until the corresponding module ships — wiring a real action
 * up later only means passing a handler here, the menu UI never changes.
 */
export interface EmployeeQuickActionHandlers {
  onEditEmployee?: (employee: EmployeeQuickActionsTarget) => void
  onAssignLeave?: (employee: EmployeeQuickActionsTarget) => void
  onEmploymentContract?: (employee: EmployeeQuickActionsTarget) => void
  onPayroll?: (employee: EmployeeQuickActionsTarget) => void
  onDocuments?: (employee: EmployeeQuickActionsTarget) => void
  onTerminateEmployment?: (employee: EmployeeQuickActionsTarget) => void
}

interface EmployeeQuickActionsProps extends EmployeeQuickActionHandlers {
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
  onEditEmployee,
  onAssignLeave,
  onEmploymentContract,
  onPayroll,
  onDocuments,
  onTerminateEmployment,
}: EmployeeQuickActionsProps) {
  const t = useTranslations("Employees.quickActions")
  const isMobile = useMediaQuery("(max-width: 767px)")
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

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
      onSelect: () => onEditEmployee?.(employee),
    },
    {
      key: "assignLeave",
      icon: CalendarDays,
      label: t("assignLeave"),
      onSelect: () => onAssignLeave?.(employee),
    },
    {
      key: "employmentContract",
      icon: FileText,
      label: t("employmentContract"),
      onSelect: () => onEmploymentContract?.(employee),
    },
    {
      key: "payroll",
      icon: Wallet,
      label: t("payroll"),
      onSelect: () => onPayroll?.(employee),
    },
    {
      key: "documents",
      icon: FolderOpen,
      label: t("documents"),
      onSelect: () => onDocuments?.(employee),
    },
    {
      key: "print",
      icon: Printer,
      label: t("printCard"),
      onSelect: () => window.print(),
    },
  ]

  function handleTerminateSelect() {
    setConfirmOpen(true)
  }

  function handleTerminateConfirm() {
    onTerminateEmployment?.(employee)
    setConfirmOpen(false)
  }

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
                render={
                  <button
                    type="button"
                    onClick={handleTerminateSelect}
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
            <DropdownMenuItem variant="destructive" onClick={handleTerminateSelect}>
              <UserX strokeWidth={1.75} />
              {t("terminateEmployment")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("terminateConfirmTitle", { name: employee.fullName })}</DialogTitle>
            <DialogDescription>{t("terminateConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("terminateConfirmCancel")}
            </DialogClose>
            <Button variant="destructive" onClick={handleTerminateConfirm}>
              {t("terminateConfirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
