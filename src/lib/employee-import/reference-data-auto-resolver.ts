import { prisma } from "@/lib/prisma"
import { createCompany } from "@/repositories/company-repository"
import { createDepartment } from "@/repositories/department-repository"
import { createPosition } from "@/repositories/position-repository"
import { normalizeReferenceName } from "@/lib/reference-data/normalize-name"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"

export interface ReferenceDataCreationSummary {
  companies: string[]
  departments: string[]
  positions: string[]
}

function emptySummary(): ReferenceDataCreationSummary {
  return { companies: [], departments: [], positions: [] }
}

/** normalized name -> the original display text first seen for it. */
type NameBucket = Map<string, string>

function addToBucket(bucket: NameBucket, rawName: string) {
  const trimmed = rawName.trim()
  if (!trimmed) return
  const key = normalizeReferenceName(trimmed)
  if (!bucket.has(key)) bucket.set(key, trimmed)
}

export interface ReferenceDataNeeds {
  companies: NameBucket
  departments: NameBucket
  /** department display name (the text a row used, or its fallback) -> position titles needed under it. */
  positionsByDepartment: Map<string, NameBucket>
}

export interface ReferenceDataRowInput {
  company: string
  department: string
  position: string
}

/**
 * Pure aggregation pass over every row's already-mapped text values — no I/O,
 * so it's trivial to unit test. Row-mapper has already substituted
 * FALLBACK_DEPARTMENT_NAME for a blank cell, so this function only ever
 * sees names to resolve-or-create, never "nothing was provided."
 */
export function collectReferenceDataNeeds(rows: ReferenceDataRowInput[]): ReferenceDataNeeds {
  const needs: ReferenceDataNeeds = {
    companies: new Map(),
    departments: new Map(),
    positionsByDepartment: new Map(),
  }

  for (const row of rows) {
    const company = row.company.trim()
    const department = row.department.trim()

    addToBucket(needs.companies, company)
    addToBucket(needs.departments, department)

    if (department && row.position.trim()) {
      const bucket = needs.positionsByDepartment.get(department) ?? new Map()
      addToBucket(bucket, row.position)
      needs.positionsByDepartment.set(department, bucket)
    }
  }

  return needs
}

/**
 * The real, transactional side of §3/§6/§7/§8 — everything missing gets
 * created exactly once, inside one Prisma transaction (so a failure partway
 * through creates nothing rather than half the reference data), and the
 * returned WizardMasterData is what row-validator resolves every row
 * against next. Existing rows are matched by normalizeReferenceName, so
 * casing/whitespace variants of an existing name are reused, never
 * duplicated (§4).
 */
export async function applyReferenceDataAutoCreate(
  needs: ReferenceDataNeeds,
  masterData: WizardMasterData
): Promise<{ masterData: WizardMasterData; created: ReferenceDataCreationSummary }> {
  const created = emptySummary()

  const companyIdByName = new Map<string, string>()
  for (const c of masterData.companies) companyIdByName.set(normalizeReferenceName(c.name), c.id)
  const departmentIdByName = new Map<string, string>()
  for (const d of masterData.departments) departmentIdByName.set(normalizeReferenceName(d.name), d.id)

  const nextCompanies = [...masterData.companies]
  const nextDepartments = [...masterData.departments]
  const nextPositions = [...masterData.positions]

  await prisma.$transaction(async (tx) => {
    for (const [key, displayName] of needs.companies) {
      if (companyIdByName.has(key)) continue
      const company = await createCompany({ name: displayName }, tx)
      companyIdByName.set(key, company.id)
      nextCompanies.push({ id: company.id, name: company.name })
      created.companies.push(displayName)
    }

    for (const [key, displayName] of needs.departments) {
      if (departmentIdByName.has(key)) continue
      const department = await createDepartment({ name: displayName }, tx)
      departmentIdByName.set(key, department.id)
      nextDepartments.push({ id: department.id, name: department.name })
      created.departments.push(displayName)
    }

    for (const [departmentName, positionTitles] of needs.positionsByDepartment) {
      const departmentId = departmentIdByName.get(normalizeReferenceName(departmentName))
      if (!departmentId) continue // that row's Department itself won't resolve — already a blocking error there

      const existingPositionKeys = new Set(
        nextPositions.filter((p) => p.departmentId === departmentId).map((p) => normalizeReferenceName(p.title))
      )
      for (const [key, displayName] of positionTitles) {
        if (existingPositionKeys.has(key)) continue
        const position = await createPosition({ title: displayName, departmentId }, tx)
        existingPositionKeys.add(key)
        nextPositions.push({ id: position.id, title: position.title, departmentId: position.departmentId })
        created.positions.push(displayName)
      }
    }
  })

  return {
    masterData: {
      ...masterData,
      companies: nextCompanies,
      departments: nextDepartments,
      positions: nextPositions,
    },
    created,
  }
}
