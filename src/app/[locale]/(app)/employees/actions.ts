"use server"

import { revalidatePath } from "next/cache"

import {
  addEmployeeProfile,
  employeeDirectory,
  getEmployeeById,
  isEmployeeIdTaken,
  updateEmployeeProfile,
} from "@/data/employee-directory"
import { generateNextEmployeeNumber, isEmployeeNumberTaken } from "@/lib/employees"
import {
  applyEditableFields,
  diffEmployeeFields,
  extractEditableFields,
  mergeDocuments,
  type FieldChange,
} from "@/lib/employee-edit-diff"
import type { EmployeeProfile } from "@/types/employee-profile"

export interface CreateEmployeeResult {
  success: boolean
  id?: string
  error?: "duplicate-id" | "duplicate-employee-number" | "unknown"
}

export interface UpdateEmployeeResult {
  success: boolean
  id?: string
  error?: "not-found" | "duplicate-employee-number" | "unknown"
  /**
   * Every field the update actually changed, as an explicit { field,
   * oldValue, newValue } list — computed unconditionally so a future Audit
   * module can persist one log entry per entry here without this action
   * being redesigned. Nothing consumes this yet.
   */
  changedFields?: FieldChange[]
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

/**
 * Fetches a full profile for the edit wizard to pre-fill from. The
 * Employees list only ever holds the slim EmployeeListItem summary
 * client-side, so opening the edit modal for a given row needs this
 * round-trip to get the nested personal/labourLaw/payroll/documents data.
 */
export async function getEmployeeProfileAction(id: string): Promise<EmployeeProfile | null> {
  return getEmployeeById(id) ?? null
}

/**
 * Same wizard, same wizardDataToProfile mapper as create — the only
 * difference is what happens to the result. Rather than inserting it,
 * this reads the record as it exists today (existingValues), compares it
 * against what the wizard just submitted (newValues), and overlays only
 * the fields the wizard actually owns onto the existing record —
 * everything else (leave, education, assets, notes, auditLog, quickStats,
 * employmentStatus, id, employment.grade/history, payroll.allowances)
 * passes through untouched. changedFields is kept as its own explicit
 * value for the same reason: a future Audit module should be able to log
 * "what changed" without this function being restructured.
 */
export async function updateEmployeeAction(
  originalId: string,
  draftProfile: EmployeeProfile
): Promise<UpdateEmployeeResult> {
  try {
    const existingProfile = getEmployeeById(originalId)
    if (!existingProfile) {
      return { success: false, error: "not-found" }
    }

    const otherEmployeeNumbers = employeeDirectory
      .filter((employee) => employee.id !== originalId)
      .map((employee) => employee.employment.employeeNumber)
    const manualEmployeeNumber = draftProfile.employment.employeeNumber.trim()

    let employeeNumber: string
    if (manualEmployeeNumber) {
      if (isEmployeeNumberTaken(manualEmployeeNumber, otherEmployeeNumbers)) {
        return { success: false, error: "duplicate-employee-number" }
      }
      employeeNumber = manualEmployeeNumber
    } else {
      employeeNumber = generateNextEmployeeNumber(otherEmployeeNumbers)
    }

    const existingValues = extractEditableFields(existingProfile)
    const newValues = {
      ...extractEditableFields(draftProfile),
      employeeNumber,
      documents: mergeDocuments(existingProfile.documents, draftProfile.documents),
    }
    const changedFields = diffEmployeeFields(existingValues, newValues)

    const updatedProfile = applyEditableFields(existingProfile, newValues)

    updateEmployeeProfile(originalId, updatedProfile)

    revalidatePath("/[locale]/employees", "page")
    revalidatePath("/[locale]/employees/[id]", "page")

    return { success: true, id: updatedProfile.id, changedFields }
  } catch {
    return { success: false, error: "unknown" }
  }
}
