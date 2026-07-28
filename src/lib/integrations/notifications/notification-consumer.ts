import { eventBus } from "@/lib/event-bus/in-memory-event-bus"
import { OffboardingEventType } from "@/lib/event-bus/event-types"
import type { DomainEvent } from "@/lib/event-bus/domain-event"

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

  for (const type of types) {
    eventBus.subscribe(type, (event) => {
      notificationLog.push(event)
    })
  }
}
