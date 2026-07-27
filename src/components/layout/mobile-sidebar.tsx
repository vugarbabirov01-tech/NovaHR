"use client"

import { useTranslations } from "next-intl"
import { Building2 } from "lucide-react"

import { Link } from "@/i18n/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { NavList } from "@/components/layout/nav-list"
import { mainNav, footerNav } from "@/lib/nav-config"

interface MobileSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const t = useTranslations("Common")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="h-14 flex-row items-center gap-2 border-b border-border p-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2"
            onClick={() => onOpenChange(false)}
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary">
              <Building2 className="size-4 text-primary-foreground" strokeWidth={2} />
            </div>
            <SheetTitle className="font-heading text-sm font-semibold">
              {t("appName")}
            </SheetTitle>
          </Link>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-2">
          <NavList items={mainNav} onNavigate={() => onOpenChange(false)} />
        </div>
        <div className="border-t border-border py-2">
          <NavList items={footerNav} onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
