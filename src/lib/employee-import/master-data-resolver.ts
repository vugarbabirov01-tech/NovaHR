import type { WizardMasterData } from "@/lib/employee-wizard-mapper"

/**
 * Name-based master-data lookups for the Import service. This is a
 * standalone module, not a refactor of employee-wizard-mapper.ts's
 * profileToWizardData — Employee Create/Edit stays completely untouched.
 * The resolution rules mirror it (Position scoped to its resolved
 * Department, Branch scoped to its resolved Company) for consistent
 * behavior across the app.
 */

function normalize(text: string): string {
  return text.trim().toLowerCase()
}

export function resolveDepartment(name: string, masterData: WizardMasterData) {
  const normalized = normalize(name)
  return masterData.departments.find((d) => normalize(d.name) === normalized)
}

export function resolvePosition(
  title: string,
  departmentId: string | undefined,
  masterData: WizardMasterData
) {
  const normalized = normalize(title)
  return masterData.positions.find(
    (p) => normalize(p.title) === normalized && (!departmentId || p.departmentId === departmentId)
  )
}

export function resolveCompany(name: string, masterData: WizardMasterData) {
  const normalized = normalize(name)
  return masterData.companies.find((c) => normalize(c.name) === normalized)
}

export function resolveBranch(name: string, companyId: string | undefined, masterData: WizardMasterData) {
  const normalized = normalize(name)
  return masterData.branches.find(
    (b) => normalize(b.name) === normalized && (!companyId || b.companyId === companyId)
  )
}

export function resolveManager(name: string, masterData: WizardMasterData) {
  const normalized = normalize(name)
  return masterData.managers.find((m) => normalize(m.name) === normalized)
}

export function resolveWorkSchedule(label: string, masterData: WizardMasterData) {
  const normalized = normalize(label)
  return masterData.workSchedules.find((s) => normalize(s.label) === normalized)
}
