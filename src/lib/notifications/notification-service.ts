import { prisma } from "@/lib/prisma"
import { getFullLegalName } from "@/lib/employees"
import { findEmployeeById } from "@/repositories/employee-repository"
import { parseParams, type NotificationView, type NotifyInput } from "@/lib/notifications/notification-types"

const LIST_LIMIT = 30

/**
 * Records a notification. It must never break the action that raised it (a
 * hire, a payroll step, a leave), so a failure is logged and swallowed.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        type: input.type,
        params: JSON.stringify(input.params ?? {}),
        href: input.href ?? "",
        entityType: input.entityType ?? "",
        entityId: input.entityId ?? "",
      },
    })
  } catch (error) {
    console.error("[notifications] could not record", input.type, error)
  }
}

/** Display name for an employee id, or an empty string when it can't be resolved. */
export async function employeeDisplayName(employeeId: string): Promise<string> {
  try {
    const employee = await findEmployeeById(employeeId)
    return employee ? getFullLegalName(employee.personal) : ""
  } catch {
    return ""
  }
}

export async function listNotifications(): Promise<{ items: NotificationView[]; unread: number }> {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: LIST_LIMIT }),
    prisma.notification.count({ where: { readAt: null } }),
  ])
  return {
    unread,
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      params: parseParams(row.params),
      href: row.href,
      createdAt: row.createdAt.toISOString(),
      read: row.readAt !== null,
    })),
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  await prisma.notification.updateMany({ where: { id, readAt: null }, data: { readAt: new Date() } })
}

export async function markAllNotificationsRead(): Promise<void> {
  await prisma.notification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } })
}
