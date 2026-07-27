import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

function SearchInput({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof Input> & { containerClassName?: string }) {
  return (
    <div className={cn("relative", containerClassName)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
      />
      <Input
        autoComplete="off"
        spellCheck={false}
        className={cn("pl-8", className)}
        {...props}
      />
    </div>
  )
}

export { SearchInput }
