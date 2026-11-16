"use server"

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/notification-service"
import type { NotificationView } from "@/lib/notifications/notification-types"

export interface NotificationsSnapshot {
  items: NotificationView[]
  unread: number
}

export async function getNotificationsAction(): Promise<NotificationsSnapshot> {
  try {
    return await listNotifications()
  } catch (error) {
    console.error("[notifications] could not load", error)
    return { items: [], unread: 0 }
  }
}

export async function markNotificationReadAction(id: string): Promise<void> {
  try {
    await markNotificationRead(id)
  } catch (error) {
    console.error("[notifications] could not mark read", error)
  }
}

export async function markAllNotificationsReadAction(): Promise<void> {
  try {
    await markAllNotificationsRead()
  } catch (error) {
    console.error("[notifications] could not mark all read", error)
  }
}
