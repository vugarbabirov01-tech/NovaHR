"use client"

import * as React from "react"
import { DayPicker, type DayButtonProps, type DayPickerProps } from "react-day-picker"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = DayPickerProps

/**
 * Thin Tailwind skin over react-day-picker's DayPicker — no date logic of
 * our own (selection, month navigation, locale-aware formatting all stay
 * the library's job; see date-picker.tsx for why that matters). Styled
 * with the same buttonVariants() the rest of the app's buttons use, so a
 * day cell and a toolbar button look like they belong to the same design
 * system rather than a bundled third-party skin.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-3",
        month_caption: "flex items-center justify-center pt-1 px-9",
        caption_label: "flex items-center gap-1 text-sm font-medium text-foreground",
        dropdowns: "flex items-center gap-1.5",
        dropdown_root: "relative",
        dropdown: "absolute inset-0 cursor-pointer opacity-0",
        nav: "flex items-center justify-between absolute inset-x-1 top-1",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground hover:text-foreground"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground hover:text-foreground"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "size-8 text-center text-xs font-medium text-muted-foreground",
        week: "flex w-full mt-1",
        day: "size-8 p-0 text-center text-sm",
        day_button: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "size-8 w-full font-normal text-foreground aria-selected:opacity-100"
        ),
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground [&>button]:font-medium",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        outside: "[&>button]:text-muted-foreground/50",
        disabled: "[&>button]:text-muted-foreground/50 [&>button]:opacity-50 [&>button]:pointer-events-none",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) => {
          if (orientation === "left") return <ChevronLeft className="size-4" strokeWidth={1.75} {...chevronProps} />
          if (orientation === "down") return <ChevronDown className="size-3.5" strokeWidth={1.75} {...chevronProps} />
          return <ChevronRight className="size-4" strokeWidth={1.75} {...chevronProps} />
        },
        // react-day-picker's own DayButton calls ref.current.focus() with
        // no options whenever autoFocus (or arrow-key navigation) lands on
        // a day — see node_modules/react-day-picker/dist/esm/components/
        // DayButton.js. With no `preventScroll`, the browser's default
        // "scroll the focused element into view" ran against wherever this
        // button sat in the DOM *before* the Popover had finished
        // positioning itself, which is what yanked the whole page back to
        // the top every time a date field's calendar icon was clicked.
        // This mirrors that same effect exactly (same day, same focused
        // modifier, so autoFocus and arrow-key navigation still work
        // identically) with the one option added that stops the jump.
        DayButton: ({ day: _day, modifiers, ...buttonProps }: DayButtonProps) => {
          const ref = React.useRef<HTMLButtonElement>(null)
          React.useEffect(() => {
            if (modifiers.focused) ref.current?.focus({ preventScroll: true })
          }, [modifiers.focused])
          return <button ref={ref} {...buttonProps} />
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
