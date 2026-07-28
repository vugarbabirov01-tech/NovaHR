// Generic domain event infrastructure — not scoped to Termination or any
// single module. Any part of the app can publish or subscribe through this
// contract; the bus itself has no knowledge of what a given event "means".

export interface DomainEvent<T = unknown> {
  id: string
  type: string
  payload: T
  timestamp: string
}

export type DomainEventHandler = (event: DomainEvent) => void | Promise<void>

export interface EventBus {
  publish(event: DomainEvent): Promise<void>
  subscribe(type: string, handler: DomainEventHandler): () => void
  unsubscribe(type: string, handler: DomainEventHandler): void
}
