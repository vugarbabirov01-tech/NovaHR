/**
 * Every notification the app can raise. The stored row holds only the type and
 * a small params object; the header renders the text in the viewer's language
 * from `Notifications.items.<type>.{title,body}` in the message files.
 */
export const NOTIFICATION_TYPES = [
  "leave.created",
  "leave.cancelled",
  "recruitment.candidate",
  "recruitment.offerAccepted",
  "recruitment.offerDeclined",
  "recruitment.hired",
  "recruitment.vacancy",
  "payroll.status",
  "offboarding.terminated",
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type NotificationParams = Record<string, string | number>

export interface NotifyInput {
  type: NotificationType
  params?: NotificationParams
  /** Path without the locale prefix, e.g. "/recruitment/abc". */
  href?: string
  entityType?: string
  entityId?: string
}

export interface NotificationView {
  id: string
  type: string
  params: NotificationParams
  href: string
  createdAt: string
  read: boolean
}

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value)
}

export function parseParams(raw: string): NotificationParams {
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as NotificationParams) : {}
  } catch {
    return {}
  }
}
