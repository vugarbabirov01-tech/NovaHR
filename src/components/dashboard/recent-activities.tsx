import {
  Activity,
  Award,
  CalendarClock,
  FileText,
  LogOut,
  type LucideIcon,
  Sparkles,
  UserPlus,
} from "lucide-react"
import { getFormatter, getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/common/empty-state"
import { getRecentActivities } from "@/lib/dashboard-service"
import type { ActivityItem, ActivityType } from "@/types/employee"
import { cn } from "@/lib/utils"

const activityConfig: Record<
  ActivityType,
  { icon: LucideIcon; className: string }
> = {
  hire: { icon: UserPlus, className: "bg-status-good/10 text-status-good" },
  leaveRequest: {
    icon: CalendarClock,
    className: "bg-status-warning/15 text-amber-700",
  },
  promotion: { icon: Award, className: "bg-primary/10 text-primary" },
  document: { icon: FileText, className: "bg-accent text-accent-foreground" },
  offboarding: {
    icon: LogOut,
    className: "bg-status-critical/10 text-status-critical",
  },
  review: { icon: Sparkles, className: "bg-accent text-accent-foreground" },
}

function activityValues(activity: ActivityItem): Record<string, string | number> {
  switch (activity.type) {
    case "hire":
      return { name: activity.actor, role: activity.role, department: activity.department }
    case "leaveRequest":
      return { name: activity.actor, days: activity.days }
    case "promotion":
      return { name: activity.actor, role: activity.role }
    case "review":
      return { name: activity.actor, period: activity.period }
    case "document":
    case "offboarding":
      return { name: activity.actor }
  }
}

export async function RecentActivities() {
  const t = await getTranslations("RecentActivities")
  const format = await getFormatter()
  const now = new Date()
  // Real hire/termination events from every employee's own
  // employment.history, plus actually-submitted leave requests — never the
  // old static 6-item src/data/activities.ts array. See getRecentActivities'
  // own doc comment for exactly which event types are (and aren't) real.
  const recentActivities = await getRecentActivities()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {recentActivities.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : (
          <ul className="flex flex-col gap-5">
            {recentActivities.map((activity) => {
              const config = activityConfig[activity.type]
              const Icon = config.icon

              return (
                <li key={activity.id} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      config.className
                    )}
                  >
                    <Icon className="size-3.5" strokeWidth={2} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="text-sm text-muted-foreground">
                      {t.rich(activity.type, {
                        ...activityValues(activity),
                        b: (chunks) => (
                          <span className="font-medium text-foreground">
                            {chunks}
                          </span>
                        ),
                      })}
                    </p>
                    <span className="text-xs text-muted-foreground/80">
                      {format.relativeTime(new Date(activity.timestamp), now)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
