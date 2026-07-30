import type { ApprovalApproverResolutionType } from "@/generated/prisma/enums"

/**
 * The seam that keeps the engine entity-agnostic even though real approver
 * resolution (DIRECT_MANAGER, ROLE, DEPARTMENT_HEAD, ...) requires real
 * org-chart knowledge the engine must never own. A business module (or a
 * future Employee/Org module) registers a resolver for a resolution type
 * independently, the same way notification-consumer.ts subscribes to the
 * Event Bus independently — the engine never imports a business module's
 * resolver, it only calls whatever was registered for the type a step
 * actually asks for.
 *
 * Phase 4C ships the registry mechanism plus exactly one default resolver
 * (SPECIFIC_EMPLOYEE), because that's the one resolution type that's pure
 * data plumbing (config already names the employee — no org-chart lookup
 * needed). Every other type is intentionally left unregistered: a step
 * that tries to use one fails closed with a clear error rather than the
 * engine guessing at organizational structure it has no business knowing.
 */
export type ApproverResolver = (config: unknown, contextPayload: unknown) => Promise<string[]> | string[]

const globalForApproverResolvers = globalThis as unknown as {
  approvalApproverResolvers?: Map<ApprovalApproverResolutionType, ApproverResolver>
}

// Same globalThis-pinning as in-memory-event-bus.ts — registrations made at
// module-load time must survive Next's dev-server module re-instantiation.
const registry: Map<ApprovalApproverResolutionType, ApproverResolver> =
  globalForApproverResolvers.approvalApproverResolvers ?? new Map()

if (process.env.NODE_ENV !== "production") {
  globalForApproverResolvers.approvalApproverResolvers = registry
}

export function registerApproverResolver(type: ApprovalApproverResolutionType, resolver: ApproverResolver): void {
  registry.set(type, resolver)
}

export function isApproverResolverRegistered(type: ApprovalApproverResolutionType): boolean {
  return registry.has(type)
}

/** Resolves a step's configured approver rule into concrete employeeIds.
 * Throws (fails closed) if nothing is registered for the type — the
 * engine never silently produces zero approvers by falling through, since
 * that would be indistinguishable from a legitimately-empty resolution
 * (which skipIfNoApproverResolved governs deliberately). */
export async function resolveApprovers(
  type: ApprovalApproverResolutionType,
  config: unknown,
  contextPayload: unknown
): Promise<string[]> {
  const resolver = registry.get(type)
  if (!resolver) {
    throw new Error(
      `No approver resolver registered for resolution type "${type}". A business module must call registerApproverResolver("${type}", ...) before a workflow step using it can activate.`
    )
  }
  return resolver(config, contextPayload)
}

registerApproverResolver("SPECIFIC_EMPLOYEE", (config) => {
  const employeeId = (config as { employeeId?: unknown } | null)?.employeeId
  return typeof employeeId === "string" && employeeId.length > 0 ? [employeeId] : []
})
