// Next.js's supported server-startup hook. This is the one place consumers
// register themselves onto the Event Bus — Termination never imports a
// consumer module directly, so it stays fully decoupled from who's
// listening.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNotificationConsumer } = await import(
      "@/lib/integrations/notifications/notification-consumer"
    )
    registerNotificationConsumer()
  }
}
