"use client"

import { useTranslations } from "next-intl"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GlobalSearch } from "@/components/layout/global-search"
import { UserMenu } from "@/components/layout/user-menu"
import { LanguageSwitcher } from "@/components/layout/language-switcher"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { NotificationBell } from "@/components/layout/notification-bell"

interface HeaderProps {
  onOpenMobileNav: () => void
}

export function Header({ onOpenMobileNav }: HeaderProps) {
  const t = useTranslations("Header")

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

      <GlobalSearch />

      <div className="flex items-center gap-1.5">
        <ThemeToggle />

        <LanguageSwitcher />

        <NotificationBell />

        <div className="mx-1 h-6 w-px bg-border" />

        <UserMenu />
      </div>
    </header>
  )
}
