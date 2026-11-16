import { eventBus } from "@/lib/event-bus/in-memory-event-bus"
import { OffboardingEventType } from "@/lib/event-bus/event-types"
import type { DomainEvent } from "@/lib/event-bus/domain-event"
import { employeeDisplayName, notify } from "@/lib/notifications/notification-service"

/**
 * Illustrative consumer proving the Event Bus decoupling actually works:
 * Termination never imports this file or anything in this directory — it
 * only publishes HRNotification/PayrollNotification/ITNotification onto the
 * bus and moves on. This subscribes independently, the same way a real
 * Notification Center module would. No delivery is implemented — this only
 * records that the event arrived.
 */
const notificationLog: DomainEvent[] = []

export function getNotificationLog(): readonly DomainEvent[] {
  return notificationLog
}

export function registerNotificationConsumer(): void {
  const types = [
    OffboardingEventType.HRNotification,
    OffboardingEventType.PayrollNotification,
    OffboardingEventType.ITNotification,
  ]

  // The visible bell notification when an employee has been terminated.
  eventBus.subscribe(OffboardingEventType.EmployeeTerminated, async (event) => {
    try {
      const employeeId = (event.payload as { employeeId?: string } | undefined)?.employeeId
      if (!employeeId) return
      await notify({
        type: "offboarding.terminated",
        params: { name: await employeeDisplayName(employeeId) },
        href: `/employees/${employeeId}`,
        entityType: "employee",
        entityId: employeeId,
      })
    } catch (error) {
      console.error("[notifications] termination notification failed", error)
    }
  })

  for (const type of types) {
    eventBus.subscribe(type, (event) => {
      notificationLog.push(event)
    })
  }
}
