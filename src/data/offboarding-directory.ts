import type { OffboardingRecord } from "@/types/offboarding"

/**
 * Same globalThis-pinning as employee-directory.ts, for the same reason:
 * Next.js's dev server can re-instantiate this module in a different
 * execution context than the one a Server Action just mutated it in. A
 * plain module-level array would silently reset on the next request.
 */
const globalForOffboardingDirectory = globalThis as unknown as {
  offboardingDirectory?: OffboardingRecord[]
}

export const offboardingDirectory: OffboardingRecord[] =
  globalForOffboardingDirectory.offboardingDirectory ?? []

if (process.env.NODE_ENV !== "production") {
  globalForOffboardingDirectory.offboardingDirectory = offboardingDirectory
}

export function addOffboardingRecord(record: OffboardingRecord): void {
  offboardingDirectory.unshift(record)
}

export function getOffboardingRecordById(id: string): OffboardingRecord | undefined {
  return offboardingDirectory.find((record) => record.id === id)
}

export function getOffboardingRecordByEmployeeId(employeeId: string): OffboardingRecord | undefined {
  return offboardingDirectory.find((record) => record.employeeId === employeeId)
}
