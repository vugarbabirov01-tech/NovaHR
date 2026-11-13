import { eventBus } from "@/lib/event-bus/in-memory-event-bus"
import { OffboardingEventType } from "@/lib/event-bus/event-types"
import { createReplacementVacancy } from "@/lib/recruitment/recruitment-service"

/**
 * Recruitment's side of the Event Bus: when Termination publishes
 * EmployeeTerminated, a draft replacement vacancy is opened for that
 * employee's place. Termination never imports this file (see
 * src/instrumentation.ts, the one place consumers register).
 *
 * The handler must never throw: the bus awaits every subscriber, so a failure
 * here would otherwise surface as a failed termination. A missed vacancy is
 * not lost either: the Recruitment page lists every departed employee who
 * still has no vacancy.
 */
export function registerRecruitmentConsumer(): void {
  eventBus.subscribe(OffboardingEventType.EmployeeTerminated, async (event) => {
    try {
      const employeeId = (event.payload as { employeeId?: string } | undefined)?.employeeId
      if (employeeId) await createReplacementVacancy(employeeId)
    } catch (error) {
      console.error("[recruitment] could not open a replacement vacancy", error)
    }
  })
}
