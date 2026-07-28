import type { DomainEvent, DomainEventHandler, EventBus } from "@/lib/event-bus/domain-event"

class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Set<DomainEventHandler>>()

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type)
    if (!handlers || handlers.size === 0) return
    await Promise.all([...handlers].map((handler) => handler(event)))
  }

  subscribe(type: string, handler: DomainEventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
    return () => this.unsubscribe(type, handler)
  }

  unsubscribe(type: string, handler: DomainEventHandler): void {
    this.handlers.get(type)?.delete(handler)
  }
}

// Same globalThis-pinning as employee-directory.ts — subscriptions registered
// at module-load time must not be silently dropped when Next's dev server
// re-instantiates this module in a fresh execution context.
const globalForEventBus = globalThis as unknown as { eventBus?: InMemoryEventBus }

export const eventBus: EventBus = globalForEventBus.eventBus ?? new InMemoryEventBus()

if (process.env.NODE_ENV !== "production") {
  globalForEventBus.eventBus = eventBus as InMemoryEventBus
}
