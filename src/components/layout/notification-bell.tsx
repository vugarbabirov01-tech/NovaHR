"use client"

import { useCallback, useEffect, useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { Bell } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "@/i18n/navigation"
import {
  getNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationsSnapshot,
} from "@/lib/notifications/notification-actions"
import { formatShortDate } from "@/lib/utils"
import type { NotificationParams, NotificationView } from "@/lib/notifications/notification-types"

const REFRESH_MS = 60_000

export function NotificationBell() {
  const t = useTranslations("Notifications")
  const tCommon = useTranslations("Common")
  const format = useFormatter()
  const router = useRouter()
  const [snapshot, setSnapshot] = useState<NotificationsSnapshot>({ items: [], unread: 0 })

  const monthsShort = tCommon.raw("monthsShort") as string[]
  const months = tCommon.raw("months") as string[]

  const refresh = useCallback(async () => {
    setSnapshot(await getNotificationsAction())
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [refresh])

  /** Dates arrive as yyyy-mm-dd, the payroll period as year + month: both are shown in the viewer's language. */
  function messageValues(type: string, params: NotificationParams) {
    const values: Record<string, string | number> = { ...params }
    for (const key of ["start", "end"]) {
      const raw = params[key]
      if (typeof raw === "string") values[key] = formatShortDate(new Date(raw), monthsShort)
    }
    if (type === "payroll.status") {
      values.period = `${months[Number(params.month) - 1] ?? params.month} ${params.year}`
      values.status = t(`payrollStatus.${String(params.status)}`)
    }
    return values
  }

  function renderItem(item: NotificationView) {
    const key = `items.${item.type.replace(".", "_")}`
    const values = messageValues(item.type, item.params)
    return { title: t(`${key}.title`, values), body: t(`${key}.body`, values) }
  }

  async function open(item: NotificationView) {
    if (!item.read) {
      setSnapshot((current) => ({
        unread: Math.max(0, current.unread - 1),
        items: current.items.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)),
      }))
      void markNotificationReadAction(item.id)
    }
    if (item.href) router.push(item.href)
  }

  async function readAll() {
    setSnapshot((current) => ({ unread: 0, items: current.items.map((entry) => ({ ...entry, read: true })) }))
    await markAllNotificationsReadAction()
  }

  return (
    <DropdownMenu onOpenChange={(isOpen) => isOpen && void refresh()}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="relative" />}>
        <Bell className="size-4" strokeWidth={1.75} />
        {snapshot.unread > 0 && (
          <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
            {snapshot.unread > 99 ? "99+" : snapshot.unread}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-sm font-medium text-foreground">{t("title")}</DropdownMenuLabel>
          {snapshot.unread > 0 && (
            <button type="button" onClick={() => void readAll()} className="text-xs text-primary hover:underline">
              {t("markAll")}
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {snapshot.items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {snapshot.items.map((item) => {
              const { title, body } = renderItem(item)
              return (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => void open(item)}
                  className="flex-col items-start gap-0.5 whitespace-normal py-2"
                >
                  <span className="flex w-full items-start gap-2">
                    {!item.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
                    <span className={item.read ? "text-sm text-muted-foreground" : "text-sm font-medium text-foreground"}>
                      {title}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{body}</span>
                  <span className="text-[11px] text-muted-foreground/70">
                    {format.relativeTime(new Date(item.createdAt), new Date())}
                  </span>
                </DropdownMenuItem>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
