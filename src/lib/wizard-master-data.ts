import { findActiveDepartments } from "@/repositories/department-repository"
import { findActivePositions } from "@/repositories/position-repository"
import { findActiveCompanies } from "@/repositories/company-repository"
import { findActiveBranches } from "@/repositories/branch-repository"
import { findActiveWorkSchedules } from "@/repositories/work-schedule-repository"
import { managerOptions } from "@/data/manager-directory"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"

/**
 * Shared server-side fetch for the wizard's master-data snapshot. New
 * module — employees/page.tsx keeps its own existing inline copy of this
 * same pattern untouched (not in scope to refactor here); this is used by
 * the new Import Wizard route and its Server Action.
 */
export async function getWizardMasterData(): Promise<WizardMasterData> {
  const [departments, positions, companies, branches, workSchedules] = await Promise.all([
    findActiveDepartments(),
    findActivePositions(),
    findActiveCompanies(),
    findActiveBranches(),
    findActiveWorkSchedules(),
  ])

  return {
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    positions: positions.map((p) => ({ id: p.id, title: p.title, departmentId: p.departmentId })),
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    branches: branches.map((b) => ({ id: b.id, name: b.name, companyId: b.companyId })),
    workSchedules: workSchedules.map((s) => ({ id: s.id, label: s.label })),
    managers: managerOptions.map((m) => ({ id: m.id, name: m.name })),
  }
}
