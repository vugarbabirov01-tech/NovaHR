import { seedEmployeeDirectory } from "@/data/employee-directory"
import { createEmployee, deleteEmployees } from "@/repositories/employee-repository"
import type { EmployeeProfile } from "@/types/employee-profile"

/**
 * Leave-module integration tests need real, complete EmployeeProfile rows
 * to exercise resolveAnnualLeaveEntitlement end-to-end (age, tenure,
 * children, disability, ...), but must never depend on — or risk mutating
 * — real HR data in dev.db. Earlier versions of these tests hardcoded ids
 * like "EMP-1042" that happened to exist back when seedEmployeeDirectory
 * (this module) was still the app's live, in-memory data source; once a
 * real company import replaced it with Prisma-backed data under a
 * different id scheme (EMP-001043-style), those tests started crashing on
 * `findEmployeeById(...)` returning null for an id that no longer exists
 * anywhere — not a Leave bug, a stale fixture.
 *
 * This reuses seedEmployeeDirectory's entries purely as ready-made,
 * internally-consistent PROFILE SHAPES (every field resolveAnnualLeave
 * Entitlement reads — dateOfBirth, hireDate, gender, children, hazardous
 * work, ...), not as a claim that those ids still exist anywhere real.
 * Each test gets its own throwaway copy under a fresh TEST-prefixed id and
 * finCode, inserted via the real createEmployee() and removed via the real
 * deleteEmployees() — the same real-repository-round-trip, create-then-
 * clean-up-in-afterEach pattern every other test in this suite already
 * uses for its own LeaveRequest/LeaveLedgerEntry fixtures (e.g.
 * leave-balance-service.test.ts). This is a test creating and destroying
 * its own data, same as those; it never reads, writes, or depends on an
 * existing real employee record.
 */

function randomFinCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let code = ""
  for (let i = 0; i < 7; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

/** A fresh id per call (not per module load) — tests in the same file can
 * each build their own fixture off the same template id without colliding,
 * and a leftover row from a crashed previous run is never reused. */
export function buildTestEmployeeProfile(templateId: string): EmployeeProfile {
  const template = seedEmployeeDirectory.find((employee) => employee.id === templateId)
  if (!template) {
    throw new Error(
      `leave-test-fixtures: no seedEmployeeDirectory entry for "${templateId}". ` +
        "This helper only clones ids that exist in src/data/employee-directory.ts."
    )
  }
  const testId = `TEST-LV-${templateId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return {
    ...template,
    id: testId,
    employment: { ...template.employment, employeeNumber: testId },
    personal: { ...template.personal, finCode: randomFinCode() },
  }
}

/**
 * Creates a throwaway employee (cloned from the given seedEmployeeDirectory
 * template id) for the duration of `fn`, then deletes it — success or
 * failure. Use this instead of a bare id string in any Leave test that
 * needs a real, resolvable EmployeeProfile.
 */
export async function withTestEmployee<T>(
  templateId: string,
  fn: (profile: EmployeeProfile) => Promise<T>
): Promise<T> {
  const profile = buildTestEmployeeProfile(templateId)
  await createEmployee(profile)
  try {
    return await fn(profile)
  } finally {
    await deleteEmployees([profile.id])
  }
}
