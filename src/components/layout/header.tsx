"use client"

import { useFormatter, useTranslations } from "next-intl"
import { Bell, Menu, Moon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SearchInput } from "@/components/common/search-input"
import { UserMenu } from "@/components/layout/user-menu"
import { LanguageSwitcher } from "@/components/layout/language-switcher"
import { notifications } from "@/data/notifications"
import type { NotificationItem } from "@/types/notification"
import { formatShortDate } from "@/lib/utils"

interface HeaderProps {
  onOpenMobileNav: () => void
}

function NotificationContent({ item }: { item: NotificationItem }) {
  const t = useTranslations("Notifications")
  const tCommon = useTranslations("Common")
  const monthsShort = tCommon.raw("monthsShort") as string[]

  if (item.type === "leaveRequest") {
    return (
      <>
        <span className="text-sm font-medium text-foreground">
          {t("leaveRequestTitle", { name: item.name })}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("leaveRequestDescription", {
            days: item.days,
            date: formatShortDate(new Date(item.date), monthsShort),
          })}
        </span>
      </>
    )
  }

  if (item.type === "newCandidate") {
    return (
      <>
        <span className="text-sm font-medium text-foreground">
          {t("newCandidateTitle")}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("newCandidateDescription", { role: item.role })}
        </span>
      </>
    )
  }

  return (
    <>
      <span className="text-sm font-medium text-foreground">
        {t("payrollCompletedTitle")}
      </span>
      <span className="text-xs text-muted-foreground">
        {t("payrollCompletedDescription", {
          month: monthsShort[new Date(item.monthDate).getUTCMonth()],
        })}
      </span>
    </>
  )
}

export function Header({ onOpenMobileNav }: HeaderProps) {
  const t = useTranslations("Header")
  const tNotifications = useTranslations("Notifications")
  const format = useFormatter()

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label={t("openNavigation")}
      >
        <Menu className="size-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <SearchInput
          placeholder={t("searchPlaceholder")}
          containerClassName="max-w-md"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-disabled="true"
                className="cursor-not-allowed text-muted-foreground/60"
              />
            }
          >
            <Moon className="size-4" strokeWidth={1.75} />
          </TooltipTrigger>
          <TooltipContent>{t("darkTheme")}</TooltipContent>
        </Tooltip>

        <LanguageSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="relative" />
            }
          >
            <Bell className="size-4" strokeWidth={1.75} />
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
              {notifications.length}
            </Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="px-2 py-1.5 text-sm font-medium text-foreground">
              {tNotifications("title")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="flex-col items-start gap-0.5 whitespace-normal py-2"
              >
                <NotificationContent item={item} />
                <span className="text-[11px] text-muted-foreground/70">
                  {format.relativeTime(new Date(item.timestamp), new Date())}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-6 w-px bg-border" />

        <UserMenu />
      </div>
    </header>
  )
}
