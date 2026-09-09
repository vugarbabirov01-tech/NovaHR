"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import {
  createEmployee,
  deleteEmployees,
  findAllEmployees,
  findEmployeeById,
  isEmployeeIdTaken,
  isFinTaken,
  updateEmployee,
} from "@/repositories/employee-repository"
import { deleteLeaveApprovalsByRequests } from "@/repositories/leave-approval-repository"
import { deleteLeaveLedgerEntriesByEmployees } from "@/repositories/leave-ledger-repository"
import {
  deleteLeaveRequestsByEmployees,
  findLeaveRequestsByEmployees,
} from "@/repositories/leave-request-repository"
import { deleteDocument, getDocumentsForEntity } from "@/lib/documents/document-service"
import { DocumentEntityType } from "@/lib/documents/document-entity-types"
import { generateNextEmployeeNumber, isEmployeeNumberTaken } from "@/lib/employees"
import {
  applyEditableFields,
  diffEmployeeFields,
  extractEditableFields,
  mergeDocuments,
  type FieldChange,
} from "@/lib/employee-edit-diff"
import { getWizardMasterData } from "@/lib/wizard-master-data"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"
import type { EmployeeProfile } from "@/types/employee-profile"

export interface CreateEmployeeResult {
  success: boolean
  id?: string
  error?: "duplicate-id" | "duplicate-employee-number" | "duplicate-fin" | "unknown"
}

export interface UpdateEmployeeResult {
  success: boolean
  id?: string
  error?: "not-found" | "duplicate-employee-number" | "duplicate-fin" | "unknown"
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
    if (await isFinTaken(profile.personal.finCode)) {
      return { success: false, error: "duplicate-fin" }
    }

    const existingEmployeeNumbers = (await findAllEmployees()).map(
      (employee) => employee.employment.employeeNumber
    )
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

    if (await isEmployeeIdTaken(finalProfile.id)) {
      return { success: false, error: "duplicate-id" }
    }

    await createEmployee(finalProfile)

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
  return findEmployeeById(id)
}

/**
 * The Wizard's master-data snapshot (departments/positions/companies/
 * branches/work schedules/managers) — the Employees list only fetches this
 * on demand, the moment Edit is actually clicked, instead of on every list
 * page load (it's otherwise unused there). The Create page still fetches it
 * directly server-side since it needs it up front for its own render.
 */
export async function getWizardMasterDataAction(): Promise<WizardMasterData> {
  return getWizardMasterData()
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
    const existingProfile = await findEmployeeById(originalId)
    if (!existingProfile) {
      return { success: false, error: "not-found" }
    }

    if (await isFinTaken(draftProfile.personal.finCode, originalId)) {
      return { success: false, error: "duplicate-fin" }
    }

    const existingValues = extractEditableFields(existingProfile)
    const newValues = {
      ...extractEditableFields(draftProfile),
      // Employee Number is the permanent reference number assigned at
      // creation — the Edit wizard renders it read-only, and this is the
      // server-side guarantee that it can never change regardless of what
      // arrives in draftProfile.
      employeeNumber: existingProfile.employment.employeeNumber,
      documents: mergeDocuments(existingProfile.documents, draftProfile.documents),
    }
    const changedFields = diffEmployeeFields(existingValues, newValues)

    const updatedProfile = applyEditableFields(existingProfile, newValues)

    await updateEmployee(originalId, updatedProfile)

    revalidatePath("/[locale]/employees", "page")
    revalidatePath("/[locale]/employees/[id]", "page")

    return { success: true, id: updatedProfile.id, changedFields }
  } catch {
    return { success: false, error: "unknown" }
  }
}

function revalidateEmployeeDelete() {
  // Best-effort cache invalidation — kept out of the write's try/catch (see
  // departments/actions.ts's revalidateDepartments for the same reasoning),
  // so a revalidation hiccup can never get reported back as a failed delete
  // even though the rows are already gone.
  try {
    revalidatePath("/[locale]/employees", "page")
    revalidatePath("/[locale]/employees/[id]", "page")
    revalidatePath("/[locale]/dashboard", "page")
  } catch {
    // Ignored — the delete already succeeded regardless of revalidation.
  }
}

export interface DeleteEmployeesResult {
  success: boolean
  deletedCount?: number
  error?: "not-found" | "unknown"
}

/**
 * Permanent deletion — distinct from Terminate (src/lib/termination/
 * actions.ts), which only sets employment.employmentStatus and keeps the
 * record. No @relation anywhere in schema.prisma points at Employee, so a
 * bare `employee.deleteMany` could never be blocked by a foreign key — but
 * Leave module rows (LeaveRequest/LeaveApproval/LeaveLedgerEntry) reference
 * employeeId as a plain string, so deleting the employee alone would leave
 * them silently orphaned. This walks that cascade explicitly: any Documents
 * attached to the employee's leave requests first (deleteDocument also
 * removes the stored file bytes, not just the DB row), then everything else
 * in one atomic transaction.
 */
export async function deleteEmployeesAction(ids: string[]): Promise<DeleteEmployeesResult> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) return { success: false, error: "not-found" }

  try {
    const leaveRequests = await findLeaveRequestsByEmployees(uniqueIds)
    const leaveRequestIds = leaveRequests.map((request) => request.id)

    for (const leaveRequestId of leaveRequestIds) {
      const documents = await getDocumentsForEntity(DocumentEntityType.LeaveRequest, leaveRequestId)
      for (const document of documents) {
        await deleteDocument(document.id)
      }
    }

    const deletedCount = await prisma.$transaction(async (tx) => {
      if (leaveRequestIds.length > 0) {
        await deleteLeaveApprovalsByRequests(leaveRequestIds, tx)
      }
      await deleteLeaveLedgerEntriesByEmployees(uniqueIds, tx)
      await deleteLeaveRequestsByEmployees(uniqueIds, tx)
      const result = await deleteEmployees(uniqueIds, tx)
      return result.count
    })

    revalidateEmployeeDelete()

    return { success: true, deletedCount }
  } catch {
    return { success: false, error: "unknown" }
  }
}
