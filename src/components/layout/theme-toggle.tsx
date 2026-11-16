"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { applyTheme } from "@/lib/theme"

export function ThemeToggle() {
  const t = useTranslations("Header")
  // The server cannot know the theme, so the icon only appears after mount.
  const [isDark, setIsDark] = useState<boolean | null>(null)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
  }, [])

  function toggle() {
    const next = !document.documentElement.classList.contains("dark")
    applyTheme(next ? "dark" : "light")
    setIsDark(next)
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={t("darkTheme")} />}
      >
        {isDark ? <Sun className="size-4" strokeWidth={1.75} /> : <Moon className="size-4" strokeWidth={1.75} />}
      </TooltipTrigger>
      <TooltipContent>{t("darkTheme")}</TooltipContent>
    </Tooltip>
  )
}
