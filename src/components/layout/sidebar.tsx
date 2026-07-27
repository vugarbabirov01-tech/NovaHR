"use client"

import { useTranslations } from "next-intl"
import { ChevronsLeft, ChevronsRight, Building2 } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { NavList } from "@/components/layout/nav-list"
import { mainNav, footerNav } from "@/lib/nav-config"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const t = useTranslations("Common")
  const tSidebar = useTranslations("Sidebar")

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-in-out lg:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 px-4",
          collapsed && "justify-center px-0"
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary">
            <Building2 className="size-4 text-primary-foreground" strokeWidth={2} />
          </div>
          {!collapsed ? (
            <span className="font-heading text-sm font-semibold tracking-tight text-sidebar-foreground">
              {t("appName")}
            </span>
          ) : null}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <NavList items={mainNav} collapsed={collapsed} />
      </div>

      <div className="flex flex-col gap-2 border-t border-sidebar-border py-2">
        <NavList items={footerNav} collapsed={collapsed} />
        <div className={cn("px-2", collapsed && "flex justify-center px-0")}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-sidebar-foreground/60 hover:text-sidebar-accent-foreground"
            onClick={onToggle}
            aria-label={collapsed ? tSidebar("expand") : tSidebar("collapse")}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <ChevronsLeft className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </aside>
  )
}
