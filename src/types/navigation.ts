import type { LucideIcon } from "lucide-react"

export interface NavItem {
  titleKey: string
  href: string
  icon: LucideIcon
  /** When present, this item renders as an expandable group instead of a direct link. */
  children?: NavItem[]
}
