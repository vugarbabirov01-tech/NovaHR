"use client"

import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/lib/utils"

/**
 * Base UI's default `aria-valuetext` runs `value` through
 * `Intl.NumberFormat(locale, { style: "percent" })` with `locale` left
 * undefined — which resolves to "the user's runtime locale" per its own
 * types. That's the Node process's default locale during SSR and the
 * visiting browser's default locale during hydration; when those differ
 * (or even just ship different ICU/CLDR data for the same locale string),
 * the formatted percent string differs too — e.g. "17%" vs "17 %" — which
 * React flags as a hydration mismatch. Plain string interpolation has no
 * locale dependency at all, so it's identical on server and client by
 * construction.
 */
function getStableAriaValueText(_formattedValue: string | null, value: number | null) {
  if (value == null) return "indeterminate progress"
  return `${Math.round(value)}%`
}

function Progress({
  className,
  children,
  value,
  getAriaValueText = getStableAriaValueText,
  ...props
}: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      value={value}
      getAriaValueText={getAriaValueText}
      data-slot="progress"
      className={cn("flex flex-wrap gap-3", className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  )
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      data-slot="progress-track"
      {...props}
    />
  )
}

function ProgressIndicator({
  className,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn("h-full bg-primary transition-all", className)}
      {...props}
    />
  )
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
  return (
    <ProgressPrimitive.Label
      className={cn("text-sm font-medium", className)}
      data-slot="progress-label"
      {...props}
    />
  )
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      className={cn(
        "ml-auto text-sm text-muted-foreground tabular-nums",
        className
      )}
      data-slot="progress-value"
      {...props}
    />
  )
}

export {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
}
