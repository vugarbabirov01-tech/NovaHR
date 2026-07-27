"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown } from "lucide-react"

import { Link, usePathname } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { NavItem } from "@/types/navigation"

interface NavListProps {
  items: NavItem[]
  collapsed?: boolean
  onNavigate?: () => void
}

function isItemActive(pathname: string | null, href: string): boolean {
  return pathname === href || pathname?.startsWith(`${href}/`) === true
}

export function NavList({ items, collapsed, onNavigate }: NavListProps) {
  const pathname = usePathname()
  const t = useTranslations("Navigation")

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {items.map((item) => {
        if (item.children && item.children.length > 0) {
          return (
            <NavGroup
              key={item.titleKey}
              item={item}
              collapsed={collapsed}
              pathname={pathname}
              t={t}
              onNavigate={onNavigate}
            />
          )
        }

        const isActive = isItemActive(pathname, item.href)
        const title = t(item.titleKey)

        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive &&
                "bg-sidebar-accent text-sidebar-accent-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            <item.icon
              className={cn(
                "size-4 shrink-0",
                isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
              )}
              strokeWidth={1.75}
            />
            {!collapsed ? (
              <span className="truncate">{title}</span>
            ) : null}
          </Link>
        )

        if (collapsed) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger render={link} />
              <TooltipContent side="right">{title}</TooltipContent>
            </Tooltip>
          )
        }

        return link
      })}
    </nav>
  )
}

interface NavGroupProps {
  item: NavItem
  collapsed?: boolean
  pathname: string | null
  t: ReturnType<typeof useTranslations>
  onNavigate?: () => void
}

function NavGroup({ item, collapsed, pathname, t, onNavigate }: NavGroupProps) {
  const children = item.children ?? []
  const hasActiveChild = children.some((child) => isItemActive(pathname, child.href))
  const [open, setOpen] = useState(hasActiveChild)
  const title = t(item.titleKey)

  // Sidebar itself is icon-only — a nested flyout isn't worth the complexity,
  // so each child becomes its own icon button instead of a collapsed group.
  if (collapsed) {
    return (
      <>
        {children.map((child) => {
          const isActive = isItemActive(pathname, child.href)
          const childTitle = t(child.titleKey)
          const link = (
            <Link
              key={child.href}
              href={child.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex h-9 items-center justify-center rounded-lg px-0 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <child.icon
                className={cn(
                  "size-4 shrink-0",
                  isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
                )}
                strokeWidth={1.75}
              />
            </Link>
          )
          return (
            <Tooltip key={child.href}>
              <TooltipTrigger render={link} />
              <TooltipContent side="right">{childTitle}</TooltipContent>
            </Tooltip>
          )
        })}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "group flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          hasActiveChild && "text-sidebar-accent-foreground"
        )}
      >
        <item.icon
          className={cn(
            "size-4 shrink-0",
            hasActiveChild ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
          )}
          strokeWidth={1.75}
        />
        <span className="flex-1 truncate text-left">{title}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-sidebar-foreground/40 transition-transform",
            open && "rotate-180"
          )}
          strokeWidth={1.75}
        />
      </button>
      {open ? (
        <div className="ml-4 flex flex-col gap-0.5 border-l border-sidebar-border pl-3.5">
          {children.map((child) => {
            const isActive = isItemActive(pathname, child.href)
            const childTitle = t(child.titleKey)
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <child.icon
                  className={cn("size-3.5 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50")}
                  strokeWidth={1.75}
                />
                <span className="truncate">{childTitle}</span>
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
