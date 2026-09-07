import { afterEach, describe, expect, it } from "vitest"

import { prisma } from "@/lib/prisma"
import { getWizardMasterData } from "@/lib/wizard-master-data"
import {
  applyReferenceDataAutoCreate,
  collectReferenceDataNeeds,
  type ReferenceDataRowInput,
} from "@/lib/employee-import/reference-data-auto-resolver"
import { FALLBACK_DEPARTMENT_NAME } from "@/lib/employee-import/reference-data-fallbacks"

const TEST_MARKER = "TEST-BAX-AUTORESOLVE"

const createdCompanyIds: string[] = []
const createdDepartmentIds: string[] = []
const createdPositionIds: string[] = []

/**
 * Cleanup is belt-and-suspenders: explicit ids tracked by each test, PLUS a
 * name-prefix sweep — so a test that creates a row and then throws before
 * it can record the id (an assertion failure between create and push)
 * still can't leave the marker's rows behind in the shared dev database.
 */
afterEach(async () => {
  if (createdPositionIds.length) await prisma.position.deleteMany({ where: { id: { in: createdPositionIds } } })
  if (createdDepartmentIds.length) await prisma.department.deleteMany({ where: { id: { in: createdDepartmentIds } } })
  if (createdCompanyIds.length) await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } })
  createdPositionIds.length = 0
  createdDepartmentIds.length = 0
  createdCompanyIds.length = 0

  await prisma.position.deleteMany({ where: { title: { contains: TEST_MARKER } } })
  await prisma.department.deleteMany({ where: { name: { contains: TEST_MARKER } } })
  await prisma.company.deleteMany({ where: { name: { contains: TEST_MARKER } } })
})

function row(overrides: Partial<ReferenceDataRowInput>): ReferenceDataRowInput {
  return { company: "", department: "", position: "", ...overrides }
}

describe("collectReferenceDataNeeds", () => {
  it("dedups the same position across many rows into a single needed entry", () => {
    const rows = Array.from({ length: 237 }, () =>
      row({ company: "Acme", department: "Eng", position: "Mühəndis" })
    )
    const needs = collectReferenceDataNeeds(rows)
    expect(needs.positionsByDepartment.get("Eng")?.size).toBe(1)
  })

  it("treats case/whitespace variants of the same name as one entry", () => {
    const rows = [
      row({ company: "Acme", department: "Eng", position: "Ofis Meneceri" }),
      row({ company: "Acme", department: "Eng", position: "  ofis meneceri " }),
      row({ company: "Acme", department: "Eng", position: "OFİS MENECERİ" }),
    ]
    const needs = collectReferenceDataNeeds(rows)
    expect(needs.positionsByDepartment.get("Eng")?.size).toBe(1)
  })

  it("keeps genuinely different spellings as separate entries", () => {
    const rows = [
      row({ company: "Acme", department: "Eng", position: "Maşinist" }),
      row({ company: "Acme", department: "Eng", position: "Maşınist" }),
    ]
    const needs = collectReferenceDataNeeds(rows)
    expect(needs.positionsByDepartment.get("Eng")?.size).toBe(2)
  })

  it("skips position grouping for a row with no department text", () => {
    const rows = [row({ company: "Acme", department: "", position: "Mühəndis" })]
    const needs = collectReferenceDataNeeds(rows)
    expect(needs.positionsByDepartment.size).toBe(0)
  })
})

describe("applyReferenceDataAutoCreate", () => {
  it("creates a missing Company/Department/Position exactly once and links the real ids", async () => {
    const masterData = await getWizardMasterData()
    const companyName = `${TEST_MARKER} Company`
    const departmentName = `${TEST_MARKER} Department`
    const positionName = `${TEST_MARKER} Mühəndis`

    const needs = collectReferenceDataNeeds([
      row({ company: companyName, department: departmentName, position: positionName }),
    ])

    const result = await applyReferenceDataAutoCreate(needs, masterData)
    const createdCompany = result.masterData.companies.find((c) => c.name === companyName)
    const createdDepartment = result.masterData.departments.find((d) => d.name === departmentName)
    const createdPosition = result.masterData.positions.find((p) => p.title === positionName)
    createdCompanyIds.push(createdCompany!.id)
    createdDepartmentIds.push(createdDepartment!.id)
    createdPositionIds.push(createdPosition!.id)

    expect(result.created.companies).toEqual([companyName])
    expect(result.created.departments).toEqual([departmentName])
    expect(result.created.positions).toEqual([positionName])
    expect(createdPosition!.departmentId).toBe(createdDepartment!.id)

    const persisted = await prisma.position.findUnique({ where: { id: createdPosition!.id } })
    expect(persisted?.departmentId).toBe(createdDepartment!.id)
  })

  it("reuses an existing entity instead of creating a duplicate", async () => {
    const masterData = await getWizardMasterData()
    const existingCompany = masterData.companies[0]
    expect(existingCompany).toBeDefined()

    const needs = collectReferenceDataNeeds([row({ company: `  ${existingCompany.name.toLowerCase()}  ` })])
    const result = await applyReferenceDataAutoCreate(needs, masterData)

    expect(result.created.companies).toEqual([])
    expect(result.masterData.companies).toHaveLength(masterData.companies.length)
  })

  it("creates the fallback department name when rows use it", async () => {
    const masterData = await getWizardMasterData()
    const companyName = `${TEST_MARKER} Fallback Co`

    const needs = collectReferenceDataNeeds([
      row({ company: companyName, department: FALLBACK_DEPARTMENT_NAME, position: `${TEST_MARKER} Pos` }),
    ])
    const result = await applyReferenceDataAutoCreate(needs, masterData)

    const company = result.masterData.companies.find((c) => c.name === companyName)!
    createdCompanyIds.push(company.id)
    const position = result.masterData.positions.find((p) => p.title === `${TEST_MARKER} Pos`)!
    createdPositionIds.push(position.id)
    if (result.created.departments.includes(FALLBACK_DEPARTMENT_NAME)) {
      const department = result.masterData.departments.find(
        (d) => d.name === FALLBACK_DEPARTMENT_NAME && d.id === position.departmentId
      )
      if (department) createdDepartmentIds.push(department.id)
    }

    expect(position.departmentId).toBeTruthy()
  })
})
