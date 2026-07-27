import {
  CalendarPlus,
  ClipboardList,
  FileBarChart,
  type LucideIcon,
  UserPlus,
} from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface QuickAction {
  labelKey: "addEmployee" | "requestLeave" | "runPayroll" | "generateReport"
  descriptionKey:
    | "addEmployeeDescription"
    | "requestLeaveDescription"
    | "runPayrollDescription"
    | "generateReportDescription"
  href: string
  icon: LucideIcon
}

const actions: QuickAction[] = [
  {
    labelKey: "addEmployee",
    descriptionKey: "addEmployeeDescription",
    href: "/employees",
    icon: UserPlus,
  },
  {
    labelKey: "requestLeave",
    descriptionKey: "requestLeaveDescription",
    href: "/leave",
    icon: CalendarPlus,
  },
  {
    labelKey: "runPayroll",
    descriptionKey: "runPayrollDescription",
    href: "/payroll",
    icon: ClipboardList,
  },
  {
    labelKey: "generateReport",
    descriptionKey: "generateReportDescription",
    href: "/reports",
    icon: FileBarChart,
  },
]

export async function QuickActions() {
  const t = await getTranslations("QuickActions")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Link
              key={action.labelKey}
              href={action.href}
              className="group flex flex-col gap-2.5 rounded-xl border border-border p-3.5 transition-colors hover:border-primary/30 hover:bg-accent/50"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-accent transition-colors group-hover:bg-primary/10">
                <action.icon
                  className="size-4 text-accent-foreground transition-colors group-hover:text-primary"
                  strokeWidth={1.75}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  {t(action.labelKey)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(action.descriptionKey)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
