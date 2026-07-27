"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface EnumSelectOption {
  value: string
  label: string
}

interface EnumSelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: EnumSelectOption[]
  placeholder: string
  disabled?: boolean
  className?: string
}

// Base UI's Select falls back to internally treating the *first* item as
// selected whenever the controlled `value` doesn't match any `SelectItem`'s
// value — which is exactly what an empty string ("nothing chosen yet") does,
// since no real item is ever given value="". That fallback selection is what
// the trigger then displays, which is how an unselected field visibly shows
// its first option (e.g. "Civil Servant") as if it were already chosen. The
// fix is to always give "unselected" its own real, matchable SelectItem
// instead of leaving the controlled value with nothing to match.
const NONE_VALUE = "__none__"

/**
 * The one place fixed-choice enum fields (contract type, gender, currency,
 * ...) get turned into a Select. Base UI's `Select.Value` only knows the raw
 * `value` string unless told otherwise — it never reads the label rendered
 * inside `SelectItem` — so every consumer must resolve `value -> label`
 * itself via a function-as-children `SelectValue`, or the trigger falls back
 * to displaying the raw enum value once something is selected. Centralizing
 * that resolution here means no call site can forget it.
 */
export function EnumSelect({ id, value, onValueChange, options, placeholder, disabled, className }: EnumSelectProps) {
  return (
    <Select
      value={value || NONE_VALUE}
      onValueChange={(v) => onValueChange(!v || v === NONE_VALUE ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className ?? "w-full"}>
        <SelectValue>
          {(v: string | null) =>
            v && v !== NONE_VALUE ? (options.find((option) => option.value === v)?.label ?? v) : placeholder
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
