"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { findAllEmployees, findEmployeeById, updateEmployee } from "@/repositories/employee-repository"
import { buildOrganizationTree, flattenOrganizationTree } from "@/lib/organization/build-tree"
import { toListItem } from "@/types/employee-profile"
import { getFullName } from "@/lib/employees"

export type ManagerAssignmentError =
  | "not-found"
  | "manager-not-found"
  | "self-reference"
  | "cycle"
  | "company-mismatch"

export interface UpdateEmployeeManagerResult {
  success: boolean
  error?: ManagerAssignmentError
}

/**
 * The one place employment.managerId is ever written, from any surface —
 * the Organization Chart's own Change Manager dialog today, and the same
 * guard protects employment-step.tsx's manager picker (Edit Employee) for
 * free the moment that form's own update also flows through here, since
 * neither surface currently has ANY self/cycle check (confirmed by reading
 * both — getManagerOptions, src/data/manager-directory.ts, never excluded
 * the employee being edited or their own reports).
 *
 * newManagerId === null clears the manager (employee becomes a root).
 * Rejects a self-reference and a cycle (assigning one of the employee's own
 * current descendants as their manager, which would orphan that whole
 * branch into a loop) — both checked against the real tree, not trusted
 * from whatever the client happened to send. Also rejects a manager from a
 * different company — Nova has no business rule anywhere that defines when
 * cross-company reporting is allowed, so the safe default is to disallow it
 * rather than silently let one company's hierarchy bleed into another's.
 */
export async function updateEmployeeManagerAction(
  employeeId: string,
  newManagerId: string | null
): Promise<UpdateEmployeeManagerResult> {
  const profile = await findEmployeeById(employeeId)
  if (!profile) return { success: false, error: "not-found" }

  if (newManagerId === employeeId) return { success: false, error: "self-reference" }

  let managerName: string | undefined
  if (newManagerId) {
    const managerProfile = await findEmployeeById(newManagerId)
    if (!managerProfile) return { success: false, error: "manager-not-found" }
    if (managerProfile.employment.company !== profile.employment.company) {
      return { success: false, error: "company-mismatch" }
    }
    managerName = getFullName(managerProfile.personal)

    const employees = (await findAllEmployees()).map((profile) => toListItem(profile))
    const tree = buildOrganizationTree(employees)
    const employeeNode = flattenOrganizationTree(tree).find((node) => node.employee.id === employeeId)
    const isDescendant = employeeNode
      ? flattenOrganizationTree(employeeNode.children).some((node) => node.employee.id === newManagerId)
      : false
    if (isDescendant) return { success: false, error: "cycle" }
  }

  await updateEmployee(employeeId, {
    ...profile,
    employment: {
      ...profile.employment,
      managerId: newManagerId ?? undefined,
      managerName,
    },
  })

  revalidatePath("/[locale]/organization", "page")
  revalidatePath("/[locale]/employees/[id]", "page")

  return { success: true }
}

export interface BulkAssignManagerResult {
  success: boolean
  error?: ManagerAssignmentError | "no-employees"
  assignedCount?: number
}

/**
 * Same rules as updateEmployeeManagerAction, applied to a whole selection at
 * once (the Unassigned-managers panel's bulk action — §3 of the Rəhbər
 * Təyinatı spec). Validates every selected employee against the chosen
 * manager BEFORE writing anything — self-reference, cycle, and company
 * match all checked up front against one shared tree/employee snapshot, so
 * the batch is all-or-nothing: a confirmation that says "N əməkdaş
 * təsirlənəcək" should never result in fewer than N actually being updated
 * because one of them silently failed partway through. The writes
 * themselves run inside one prisma.$transaction for the same reason.
 */
export async function bulkAssignManagerAction(
  employeeIds: string[],
  newManagerId: string | null
): Promise<BulkAssignManagerResult> {
  const uniqueIds = Array.from(new Set(employeeIds.filter(Boolean)))
  if (uniqueIds.length === 0) return { success: false, error: "no-employees" }

  const employees = (await findAllEmployees()).map((profile) => toListItem(profile))
  const byId = new Map(employees.map((employee) => [employee.id, employee]))

  let managerName: string | undefined
  if (newManagerId) {
    if (uniqueIds.includes(newManagerId)) return { success: false, error: "self-reference" }

    const managerProfile = await findEmployeeById(newManagerId)
    if (!managerProfile) return { success: false, error: "manager-not-found" }
    managerName = getFullName(managerProfile.personal)

    const tree = buildOrganizationTree(employees)
    const flat = flattenOrganizationTree(tree)
    for (const employeeId of uniqueIds) {
      const employee = byId.get(employeeId)
      if (!employee) continue
      if (employee.company !== managerProfile.employment.company) {
        return { success: false, error: "company-mismatch" }
      }
      const employeeNode = flat.find((node) => node.employee.id === employeeId)
      const isDescendant = employeeNode
        ? flattenOrganizationTree(employeeNode.children).some((node) => node.employee.id === newManagerId)
        : false
      if (isDescendant) return { success: false, error: "cycle" }
    }
  }

  let assignedCount = 0
  await prisma.$transaction(async (tx) => {
    for (const employeeId of uniqueIds) {
      const profile = await findEmployeeById(employeeId, tx)
      if (!profile) continue
      await updateEmployee(
        employeeId,
        {
          ...profile,
          employment: {
            ...profile.employment,
            managerId: newManagerId ?? undefined,
            managerName,
          },
        },
        tx
      )
      assignedCount++
    }
  })

  revalidatePath("/[locale]/organization", "page")
  revalidatePath("/[locale]/employees/[id]", "page")

  return { success: true, assignedCount }
}

export interface SetTopExecutiveResult {
  success: boolean
  error?: "not-found"
}

/**
 * Designates (or un-designates) an employee as their company's "Baş
 * rəhbər" — the one legitimately manager-less employee at the top of a
 * company's real hierarchy, excluded from the Unassigned-managers list/
 * count instead of looking like an overlooked data gap (§11/§12). At most
 * one per company: setting the flag clears it from whoever previously held
 * it in that same company, inside the same transaction, so the invariant
 * can never be violated by two sequential calls racing each other.
 */
export async function setTopExecutiveAction(
  employeeId: string,
  isTopExecutive: boolean
): Promise<SetTopExecutiveResult> {
  const profile = await findEmployeeById(employeeId)
  if (!profile) return { success: false, error: "not-found" }

  await prisma.$transaction(async (tx) => {
    if (isTopExecutive) {
      const allProfiles = await findAllEmployees(tx)
      const previousHolders = allProfiles.filter(
        (other) =>
          other.id !== employeeId &&
          other.employment.company === profile.employment.company &&
          other.employment.isTopExecutive
      )
      for (const holder of previousHolders) {
        await updateEmployee(
          holder.id,
          { ...holder, employment: { ...holder.employment, isTopExecutive: false } },
          tx
        )
      }
    }

    await updateEmployee(employeeId, { ...profile, employment: { ...profile.employment, isTopExecutive } }, tx)
  })

  revalidatePath("/[locale]/organization", "page")
  revalidatePath("/[locale]/employees/[id]", "page")

  return { success: true }
}
