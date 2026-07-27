import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export interface StepperStep {
  key: string
  label: string
}

interface StepperProps {
  steps: StepperStep[]
  currentIndex: number
  onStepClick?: (index: number) => void
  className?: string
}

export function Stepper({ steps, currentIndex, onStepClick, className }: StepperProps) {
  return (
    <ol className={cn("hidden items-start gap-2 lg:flex", className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isClickable = Boolean(onStepClick) && index <= currentIndex

        return (
          <li key={step.key} className="flex flex-1 items-center gap-2 last:flex-none">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => onStepClick?.(index)}
              className={cn(
                "flex items-center gap-2 rounded-lg text-left",
                isClickable && "cursor-pointer"
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                  !isCompleted && !isCurrent && "border-border text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-sm font-medium whitespace-nowrap",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 ? (
              <span
                className={cn(
                  "h-px flex-1",
                  isCompleted ? "bg-primary" : "bg-border"
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
