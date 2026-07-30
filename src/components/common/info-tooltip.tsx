"use client"

import { Info } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface InfoTooltipProps {
  content: string
}

/**
 * A small info affordance for a label that isn't self-explanatory at a
 * glance — e.g. "Opening Balance" next to a number. Keyboard-focusable
 * (native button via TooltipTrigger) and announced to screen readers via
 * its own aria-label, since the icon carries no visible text of its own.
 */
export function InfoTooltip({ content }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={content}
        className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Info className="size-3.5" strokeWidth={1.75} />
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  )
}
