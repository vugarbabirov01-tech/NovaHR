import { cache } from "react"

import { findActiveDepartments } from "@/repositories/department-repository"
import { findActivePositions } from "@/repositories/position-repository"
import { findActiveCompanies } from "@/repositories/company-repository"
import { findActiveBranches } from "@/repositories/branch-repository"
import { findActiveWorkSchedules } from "@/repositories/work-schedule-repository"
import { getManagerOptions } from "@/data/manager-directory"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"

/**
 * Shared server-side fetch for the wizard's master-data snapshot — used by
 * the Create page, the Import Wizard, and the Employees list's on-demand
 * Edit action. Wrapped in React's cache() so multiple call sites resolving
 * within the same request/render (e.g. Create's page + metadata) share one
 * set of repository queries instead of issuing them again each time.
 */
export const getWizardMasterData = cache(async (): Promise<WizardMasterData> => {
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
    managers: getManagerOptions().map((m) => ({ id: m.id, name: m.name })),
  }
})
