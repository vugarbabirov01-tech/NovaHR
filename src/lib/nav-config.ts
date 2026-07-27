import {
  LayoutDashboard,
  Users,
  Building2,
  Network,
  Briefcase,
  Layers,
  Landmark,
  MapPin,
  CalendarRange,
  Contact,
  ShieldCheck,
  UserSearch,
  CalendarClock,
  Fingerprint,
  Wallet,
  TrendingUp,
  Laptop,
  BarChart3,
  Settings,
} from "lucide-react"

import type { NavItem } from "@/types/navigation"

export const mainNav: NavItem[] = [
  { titleKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { titleKey: "employees", href: "/employees", icon: Users },
  { titleKey: "organization", href: "/organization", icon: Network },
  {
    titleKey: "administration",
    href: "/companies",
    icon: ShieldCheck,
    children: [
      { titleKey: "companies", href: "/companies", icon: Landmark },
      { titleKey: "branches", href: "/branches", icon: MapPin },
      { titleKey: "departments", href: "/departments", icon: Building2 },
      { titleKey: "positions", href: "/positions", icon: Briefcase },
      { titleKey: "grades", href: "/grades", icon: Layers },
      { titleKey: "workSchedules", href: "/work-schedules", icon: CalendarRange },
      { titleKey: "employmentTypes", href: "/employment-types", icon: Contact },
    ],
  },
  { titleKey: "recruitment", href: "/recruitment", icon: UserSearch },
  { titleKey: "leave", href: "/leave", icon: CalendarClock },
  { titleKey: "attendance", href: "/attendance", icon: Fingerprint },
  { titleKey: "payroll", href: "/payroll", icon: Wallet },
  { titleKey: "performance", href: "/performance", icon: TrendingUp },
  { titleKey: "assets", href: "/assets", icon: Laptop },
  { titleKey: "reports", href: "/reports", icon: BarChart3 },
]

export const footerNav: NavItem[] = [
  { titleKey: "settings", href: "/settings", icon: Settings },
]
