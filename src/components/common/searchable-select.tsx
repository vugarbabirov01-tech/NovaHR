"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SearchableSelectOption {
  value: string
  label: string
  hint?: string
  /** Text the search box matches against instead of `label` — lets a
   * caller make an option findable by more than its displayed primary
   * text (e.g. an employee's ID/FIN alongside their name) without
   * showing that extra text as part of the label itself. Falls back to
   * `label` when omitted, so every existing caller is unaffected. */
  searchValue?: string
}

interface SearchableSelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  disabled?: boolean
  footer?: ReactNode
  className?: string
}

interface PopupPosition {
  left: number
  width: number
  placement: "top" | "bottom"
  /** Set when placement is "bottom" — distance from the viewport top to the popup's top edge. */
  top?: number
  /** Set when placement is "top" — distance from the viewport bottom to the popup's bottom edge. */
  bottom?: number
  /** Clamped to whatever space is actually available on the chosen side, so the popup can never push past the viewport edge or the app's sticky header/footer. */
  maxHeight: number
}

const VIEWPORT_EDGE_PADDING = 8
const PREFERRED_POPUP_HEIGHT = 320
const MIN_POPUP_HEIGHT = 120

/**
 * Finds the true top/bottom boundary of visible space, accounting for any
 * fixed/sticky chrome pinned to that edge (e.g. the app header, or a wizard's
 * sticky action bar) — those cover real pixels even though they're not part
 * of the normal document flow, so window.innerHeight/0 alone would let the
 * popup render underneath them. Generic: works for any such element anywhere
 * in the app, not just one page's specific footer.
 */
function findEdgeBoundary(edge: "top" | "bottom"): number {
  const viewportHeight = window.innerHeight
  const probeY = edge === "bottom" ? viewportHeight - 1 : 1
  const probeX = window.innerWidth / 2
  let boundary = edge === "bottom" ? viewportHeight : 0
  for (const el of document.elementsFromPoint(probeX, probeY)) {
    const style = window.getComputedStyle(el)
    if (style.position !== "fixed" && style.position !== "sticky") continue
    const rect = el.getBoundingClientRect()
    if (edge === "bottom" && rect.bottom >= viewportHeight - 2 && rect.top < boundary) {
      boundary = rect.top
    } else if (edge === "top" && rect.top <= 2 && rect.bottom > boundary) {
      boundary = rect.bottom
    }
  }
  return boundary
}

/**
 * A filterable single-select combobox — the design system's `Select` has no
 * built-in search box, and master-data catalogs here are meant to scale to
 * hundreds/thousands of rows (departments, positions, branches...), so a
 * plain dropdown isn't usable at that scale. Reused everywhere a field
 * consumes a master-data list, with an optional `footer` slot for inline
 * "+ Add X" creation affordances.
 *
 * The popup is rendered through a portal into `document.body` and positioned
 * from the trigger's `getBoundingClientRect()` so it's never clipped by an
 * ancestor `overflow: hidden` (e.g. `Card`) the way an inline `position:
 * absolute` popup would be.
 */
export function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  footer,
  className,
}: SearchableSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [position, setPosition] = useState<PopupPosition | null>(null)

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()

    const viewportTop = findEdgeBoundary("top")
    const viewportBottom = findEdgeBoundary("bottom")
    const spaceBelow = viewportBottom - rect.bottom - VIEWPORT_EDGE_PADDING
    const spaceAbove = rect.top - viewportTop - VIEWPORT_EDGE_PADDING

    // Prefer opening downward, as before — flip up only when there isn't
    // enough room below AND the space above is actually bigger, so a select
    // near the top of the screen still opens down like it always did.
    const openUpward = spaceBelow < PREFERRED_POPUP_HEIGHT && spaceAbove > spaceBelow
    const available = openUpward ? spaceAbove : spaceBelow
    const maxHeight = Math.max(Math.min(PREFERRED_POPUP_HEIGHT, available), Math.min(MIN_POPUP_HEIGHT, available))

    setPosition({
      left: rect.left,
      width: rect.width,
      placement: openUpward ? "top" : "bottom",
      top: openUpward ? undefined : rect.bottom + 4,
      bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
      maxHeight,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    function handleReposition() {
      updatePosition()
    }
    window.addEventListener("scroll", handleReposition, true)
    window.addEventListener("resize", handleReposition)
    return () => {
      window.removeEventListener("scroll", handleReposition, true)
      window.removeEventListener("resize", handleReposition)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      setOpen(false)
      setQuery("")
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
        setQuery("")
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open])

  const selectedOption = options.find((option) => option.value === value)

  const filtered = useMemo(() => {
    // Case-insensitive, space-agnostic substring match — stripping spaces
    // from both sides means a query typed without the label's own spacing
    // still matches, without needing per-field search logic here.
    const q = query.toLowerCase().replace(/\s+/g, "")
    if (!q) return options
    return options.filter((option) =>
      (option.searchValue ?? option.label).toLowerCase().replace(/\s+/g, "").includes(q)
    )
  }, [options, query])

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm whitespace-nowrap outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50"
      >
        <span className={cn("truncate text-left", !selectedOption && "text-muted-foreground")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      </button>
      {open && position
        ? createPortal(
            <div
              ref={popupRef}
              style={{
                position: "fixed",
                top: position.top,
                bottom: position.bottom,
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
              data-placement={position.placement}
              className="z-50 flex min-w-56 flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
            >
              <div className="shrink-0 border-b border-border p-1.5">
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-7 w-full rounded-md border-none bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">{emptyText}</p>
                ) : (
                  filtered.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onValueChange(option.value)
                        setOpen(false)
                        setQuery("")
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{option.label}</span>
                        {option.hint ? (
                          <span className="truncate text-xs text-muted-foreground">{option.hint}</span>
                        ) : null}
                      </span>
                      {option.value === value ? (
                        <Check className="size-3.5 shrink-0" strokeWidth={1.75} />
                      ) : null}
                    </button>
                  ))
                )}
              </div>
              {footer ? (
                <div className="shrink-0 border-t border-border p-1" onClick={() => setOpen(false)}>
                  {footer}
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
