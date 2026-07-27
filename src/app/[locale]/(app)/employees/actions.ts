"use server"

import { revalidatePath } from "next/cache"

import { addEmployeeProfile, employeeDirectory, isEmployeeIdTaken } from "@/data/employee-directory"
import { generateNextEmployeeNumber, isEmployeeNumberTaken } from "@/lib/employees"
import type { EmployeeProfile } from "@/types/employee-profile"

export interface CreateEmployeeResult {
  success: boolean
  id?: string
  error?: "duplicate-id" | "duplicate-employee-number" | "unknown"
}

/**
 * Takes an already-built EmployeeProfile, not the raw wizard form state.
 * The wizard's master-data selections (department/position/company/branch/
 * schedule/manager) live in client-side stores — including anything HR
 * just created inline via "+ Add Position" / "+ Add Department" — so
 * resolving those ids to display values (wizardDataToProfile) has to
 * happen on the client, in the same runtime that actually holds those
 * mutations. Doing it here on the server would only ever see the seed
 * data, never anything added during the current session.
 *
 * Employee Number is optional in the wizard. Resolving it — either
 * validating the manually entered value or generating the next one in the
 * `EMP-######` sequence — has to happen here rather than on the client,
 * because only the server holds the full, current employee directory this
 * runs against. The current architecture derives `id` from Employee Number
 * (unchanged — no database/identity redesign in this task), so the id is
 * finalized here too, together with the one employment-history entry that
 * embeds it.
 */
export async function createEmployeeAction(
  profile: EmployeeProfile
): Promise<CreateEmployeeResult> {
  try {
    const existingEmployeeNumbers = employeeDirectory.map((employee) => employee.employment.employeeNumber)
    const manualEmployeeNumber = profile.employment.employeeNumber.trim()

    let employeeNumber: string
    if (manualEmployeeNumber) {
      if (isEmployeeNumberTaken(manualEmployeeNumber, existingEmployeeNumbers)) {
        return { success: false, error: "duplicate-employee-number" }
      }
      employeeNumber = manualEmployeeNumber
    } else {
      employeeNumber = generateNextEmployeeNumber(existingEmployeeNumbers)
    }

    const finalProfile: EmployeeProfile = {
      ...profile,
      id: employeeNumber,
      employment: {
        ...profile.employment,
        employeeNumber,
        history: profile.employment.history.map((event) => ({ ...event, id: `EH-${employeeNumber}-1` })),
      },
    }

    if (isEmployeeIdTaken(finalProfile.id)) {
      return { success: false, error: "duplicate-id" }
    }

    addEmployeeProfile(finalProfile)

    // Bust both the list and the profile-detail cache for every locale so
    // the new employee shows up immediately — in the list, card view,
    // search/filters (all derived from the same server-fetched array), and
    // its own profile page — without a manual refresh.
    revalidatePath("/[locale]/employees", "page")
    revalidatePath("/[locale]/employees/[id]", "page")

    return { success: true, id: finalProfile.id }
  } catch {
    return { success: false, error: "unknown" }
  }
}
