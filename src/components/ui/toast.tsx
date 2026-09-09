"use client"

import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { CheckCircle2, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A manager created outside React so any Server Action's `.then` handler
 * (or any other non-component code) can call `toast.success(...)` directly
 * — the same ergonomics libraries like sonner offer — without needing a
 * hook or context at the call site. <Toaster/> below is the one place that
 * wires this manager into Base UI's actual rendering.
 */
export const toastManager = ToastPrimitive.createToastManager()

export const toast = {
  success: (title: string, description?: string) =>
    toastManager.add({ type: "success", title, description }),
  error: (title: string, description?: string) =>
    toastManager.add({ type: "error", title, description }),
}

function ToasterViewport() {
  const { toasts } = ToastPrimitive.useToastManager()

  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col-reverse gap-2 sm:right-6 sm:bottom-6">
        {toasts.map((toastItem) => (
          <ToastPrimitive.Root
            key={toastItem.id}
            toast={toastItem}
            className={cn(
              "flex items-start gap-2.5 rounded-xl bg-popover p-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition-all duration-300",
              "data-[type=success]:ring-primary/20",
              "data-[type=error]:ring-destructive/30",
              "data-starting-style:translate-y-2 data-starting-style:opacity-0",
              "data-ending-style:opacity-0"
            )}
          >
            {toastItem.type === "error" ? (
              <XIcon className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={1.75} />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <ToastPrimitive.Title className="font-medium text-foreground" />
              <ToastPrimitive.Description className="text-muted-foreground" />
            </div>
            <ToastPrimitive.Close
              className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:bg-muted"
              aria-label="Close"
            >
              <XIcon className="size-3.5" strokeWidth={1.75} />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  )
}

/** Mounted once at the app root (src/app/[locale]/layout.tsx) — every
 * `toast.success(...)`/`toast.error(...)` call anywhere in the app renders
 * here regardless of which page triggered it. */
export function Toaster() {
  return (
    <ToastPrimitive.Provider toastManager={toastManager}>
      <ToasterViewport />
    </ToastPrimitive.Provider>
  )
}
