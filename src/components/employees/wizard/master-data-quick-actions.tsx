"use client"

import { Plus, Settings2 } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { buttonVariants, Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface MasterDataQuickActionsProps {
  onAdd: () => void
  manageHref: string
  addLabel: string
  manageLabel: string
  disabled?: boolean
}

/**
 * The "+" / gear pair shown next to a master-data Select in the Employee
 * Wizard. "+" opens a create-only modal that reuses the same Administration
 * dialog and Server Action; the gear opens the full Administration page in a
 * new tab for anything beyond create (edit, archive, restore, search) — the
 * wizard itself never gets that management surface.
 */
export function MasterDataQuickActions({
  onAdd,
  manageHref,
  addLabel,
  manageLabel,
  disabled,
}: MasterDataQuickActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={onAdd}
              disabled={disabled}
              aria-label={addLabel}
            />
          }
        >
          <Plus />
        </TooltipTrigger>
        <TooltipContent>{addLabel}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={manageHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={manageLabel}
              className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
            />
          }
        >
          <Settings2 />
        </TooltipTrigger>
        <TooltipContent>{manageLabel}</TooltipContent>
      </Tooltip>
    </div>
  )
}
