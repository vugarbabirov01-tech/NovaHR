import { defineRouting } from "next-intl/routing"

export const locales = ["en", "az", "ru"] as const

export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = "en"

export const localeLabels: Record<AppLocale, { native: string; flag: string }> = {
  en: { native: "English", flag: "🇬🇧" },
  az: { native: "Azərbaycan", flag: "🇦🇿" },
  ru: { native: "Русский", flag: "🇷🇺" },
}

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
})
