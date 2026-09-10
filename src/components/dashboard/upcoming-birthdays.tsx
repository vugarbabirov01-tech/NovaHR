import { Cake } from "lucide-react"
import { getFormatter, getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/common/empty-state"
import { getUpcomingBirthdays } from "@/lib/dashboard-service"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export async function UpcomingBirthdays() {
  const t = await getTranslations("UpcomingBirthdays")
  const format = await getFormatter()
  // Real personal.dateOfBirth for every active employee, within the next
  // 14 days — see getUpcomingBirthdays' own doc comment. Never the old
  // static 4-person src/data/employees.ts array.
  const upcomingBirthdays = await getUpcomingBirthdays(14)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {upcomingBirthdays.length === 0 ? (
          <EmptyState
            icon={Cake}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {upcomingBirthdays.map((person) => (
              <li key={person.id} className="flex items-center gap-3">
                <Avatar size="sm">
                  <AvatarImage src={person.avatarUrl} alt={person.name} />
                  <AvatarFallback className="bg-accent text-accent-foreground text-[11px]">
                    {initials(person.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {person.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {person.department}
                  </span>
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                  {format.dateTime(new Date(person.date), {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
