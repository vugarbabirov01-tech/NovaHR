"use client"

import { useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Check, Languages, Loader2 } from "lucide-react"

import { usePathname, useRouter } from "@/i18n/navigation"
import { locales, localeLabels, type AppLocale } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function LanguageSwitcher() {
  const t = useTranslations("Header")
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSelect(nextLocale: AppLocale) {
    if (nextLocale === locale) return
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale })
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("changeLanguage")}
            disabled={isPending}
          />
        }
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <Languages className="size-4" strokeWidth={1.75} />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {locales.map((item) => (
          <DropdownMenuItem
            key={item}
            onClick={() => handleSelect(item)}
            className="justify-between"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden="true">{localeLabels[item].flag}</span>
              <span>{localeLabels[item].native}</span>
            </span>
            {item === locale ? <Check className="size-3.5 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
