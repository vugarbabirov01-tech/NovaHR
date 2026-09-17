"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Briefcase,
  Building,
  Building2,
  Landmark,
  Loader2,
  MapPin,
  Users,
  type LucideIcon,
} from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { SearchInput } from "@/components/common/search-input"
import { cn } from "@/lib/utils"
import { globalSearchAction } from "@/lib/global-search/global-search-actions"
import type {
  GlobalSearchCategory,
  GlobalSearchCategoryResult,
  GlobalSearchResponse,
  GlobalSearchResultItem,
} from "@/types/global-search"

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

// Same icon per entity as src/lib/nav-config.ts's own sidebar links, for
// visual consistency — workLocations gets its own (Building, not the
// Branches' MapPin or Departments' Building2) since it has no nav item of
// its own to borrow from.
const CATEGORY_ICONS: Record<GlobalSearchCategory, LucideIcon> = {
  employees: Users,
  companies: Landmark,
  branches: MapPin,
  departments: Building2,
  positions: Briefcase,
  workLocations: Building,
}

export function GlobalSearch() {
  const t = useTranslations("GlobalSearch")
  const router = useRouter()

  const [query, setQuery] = useState("")
  const [response, setResponse] = useState<GlobalSearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)

  const flatItems = useMemo(
    () => response?.categories.flatMap((category) => category.items) ?? [],
    [response]
  )

  // Debounced search — a `cancelled` flag (not just clearTimeout) guards
  // against a slower earlier request resolving AFTER a newer one and
  // overwriting its results.
  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResponse(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    const timer = setTimeout(async () => {
      const result = await globalSearchAction(query)
      if (!cancelled) {
        setResponse(result)
        setIsLoading(false)
        setActiveIndex(-1)
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  // Ctrl+K / Cmd+K focuses and opens the search — added once, and only
  // ever acts on the exact combo, so plain "k" typed anywhere else on the
  // page is never intercepted.
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        containerRef.current?.querySelector<HTMLInputElement>("input")?.focus()
        setIsOpen(true)
      }
    }
    document.addEventListener("keydown", handleShortcut)
    return () => document.removeEventListener("keydown", handleShortcut)
  }, [])

  // Outside click closes the dropdown — same technique SearchableSelect
  // (src/components/common/searchable-select.tsx) already uses.
  useEffect(() => {
    if (!isOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [isOpen])

  function handleNavigate(href: string) {
    setIsOpen(false)
    setQuery("")
    setResponse(null)
    router.push(href)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false)
      event.currentTarget.blur()
      return
    }
    if (!isOpen || flatItems.length === 0) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((prev) => (prev + 1) % flatItems.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      const active = flatItems[activeIndex]
      if (active) handleNavigate(active.href)
    }
  }

  const showDropdown = isOpen && query.trim().length >= MIN_QUERY_LENGTH

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <SearchInput
        placeholder={t("placeholder")}
        containerClassName="max-w-md"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {showDropdown ? (
        <div className="absolute top-full left-0 z-50 mt-1.5 max-h-[70vh] w-full max-w-md overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
              {t("searching")}
            </div>
          ) : !response || response.categories.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            <div className="flex flex-col divide-y divide-border py-1">
              {response.categories.map((category) => (
                <CategorySection
                  key={category.category}
                  result={category}
                  flatItems={flatItems}
                  activeIndex={activeIndex}
                  onNavigate={handleNavigate}
                  label={t(category.category)}
                  showAllLabel={t("showAll", { count: category.totalCount })}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

interface CategorySectionProps {
  result: GlobalSearchCategoryResult
  flatItems: GlobalSearchResultItem[]
  activeIndex: number
  onNavigate: (href: string) => void
  label: string
  showAllLabel: string
}

/** A plain left-click navigates through onNavigate (resets the dropdown
 * first, since the header persists across route changes); a modifier
 * (Ctrl/Cmd/Shift/Alt) or middle-click means "open in a new tab" and must
 * fall through to the anchor's native behavior untouched — the current
 * tab's dropdown state is irrelevant to a tab that isn't navigating. */
function handleResultClick(event: React.MouseEvent, href: string, onNavigate: (href: string) => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  onNavigate(href)
}

function CategorySection({
  result,
  flatItems,
  activeIndex,
  onNavigate,
  label,
  showAllLabel,
}: CategorySectionProps) {
  const Icon = CATEGORY_ICONS[result.category]

  return (
    <div className="flex flex-col py-1">
      <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.75} />
        {label}
        <span className="tabular-nums">({result.totalCount})</span>
      </div>
      {result.items.map((item) => {
        const isActive = flatItems[activeIndex]?.id === item.id && flatItems[activeIndex]?.category === item.category
        return (
          <Link
            key={`${item.category}-${item.id}`}
            href={item.href}
            onClick={(event) => handleResultClick(event, item.href, onNavigate)}
            className={cn(
              "flex flex-col gap-0.5 px-3 py-1.5 text-sm outline-none",
              isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <span className="truncate font-medium text-foreground">{item.title}</span>
            {item.subtitle ? <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span> : null}
          </Link>
        )
      })}
      {result.showAllHref ? (
        <Link
          href={result.showAllHref}
          onClick={(event) => handleResultClick(event, result.showAllHref!, onNavigate)}
          className="px-3 py-1.5 text-xs font-medium text-primary hover:underline"
        >
          {showAllLabel}
        </Link>
      ) : null}
    </div>
  )
}
