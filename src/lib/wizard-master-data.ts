import { cache } from "react"

import { findActiveDepartments, findAllDepartments } from "@/repositories/department-repository"
import { findActivePositions, findAllPositions } from "@/repositories/position-repository"
import { findActiveCompanies, findAllCompanies } from "@/repositories/company-repository"
import { findActiveBranches } from "@/repositories/branch-repository"
import { findActiveWorkSchedules, findAllWorkSchedules } from "@/repositories/work-schedule-repository"
import { getManagerOptions } from "@/data/manager-directory"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"

/**
 * Shared server-side fetch for the wizard's master-data snapshot — used by
 * the Create page, the Import Wizard, and the Edit page. Wrapped in React's
 * cache() so multiple call sites resolving within the same request/render
 * (e.g. Create's page + metadata) share one set of repository queries
 * instead of issuing them again each time — `includeArchived` is part of
 * the cache key too, so the two variants below never collide.
 *
 * Department/Position/Company default to active-only (Create and Import
 * must never offer or auto-assign something HR just archived). Edit is the
 * one exception: profileToWizardData resolves an employee's CURRENT values
 * by matching their stored name against this same list — if HR archives a
 * department/position/company after employees were already assigned to it
 * (a real scenario, not hypothetical: this happened here — the imported
 * employees' whole "Ümumi Şöbə" department, plus every original seed
 * department/position/company, ended up archived), that match silently
 * fails and the field — and everything scoped under it, like Position under
 * Department — comes back empty. `includeArchived: true` is how Edit keeps
 * every existing employee's current assignment resolvable and visible,
 * without changing what Create/Import ever offer for new ones.
 */
export const getWizardMasterData = cache(
  async (options?: { includeArchived?: boolean }): Promise<WizardMasterData> => {
    const includeArchived = options?.includeArchived ?? false
    const [departments, positions, companies, branches, workSchedules, managers] = await Promise.all([
      includeArchived ? findAllDepartments() : findActiveDepartments(),
      includeArchived ? findAllPositions() : findActivePositions(),
      includeArchived ? findAllCompanies() : findActiveCompanies(),
      findActiveBranches(),
      includeArchived ? findAllWorkSchedules() : findActiveWorkSchedules(),
      getManagerOptions(),
    ])

    return {
      departments: departments.map((d) => ({ id: d.id, name: d.name })),
      positions: positions.map((p) => ({ id: p.id, title: p.title, departmentId: p.departmentId })),
      companies: companies.map((c) => ({ id: c.id, name: c.name })),
      branches: branches.map((b) => ({ id: b.id, name: b.name, companyId: b.companyId })),
      workSchedules: workSchedules.map((s) => ({ id: s.id, label: s.label })),
      managers: managers.map((m) => ({ id: m.id, name: m.name })),
    }
  }
)
