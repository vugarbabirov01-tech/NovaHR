import { describe, expect, it } from "vitest"

import { mapRawRow } from "@/lib/employee-import/row-mapper"
import {
  CONTRACT_TYPE_VALUE_LABELS,
  EMPLOYMENT_TYPE_VALUE_LABELS,
  GENDER_VALUE_LABELS,
  MARITAL_STATUS_VALUE_LABELS,
  WORK_LOCATION_TYPE_VALUE_LABELS,
} from "@/lib/employee-import/column-mapping"
import type { ColumnMapping } from "@/lib/employee-import/types"

function mapSingleColumn(field: ColumnMapping["field"], cellValue: string) {
  const columnMapping: ColumnMapping[] = [{ excelColumn: "Col A", field }]
  const { mapped } = mapRawRow({ rowNumber: 1, cells: { "Col A": cellValue } }, columnMapping)
  return mapped
}

/**
 * Regression coverage for the export/import round trip: every canonical AZ
 * label profileToExportRow.test.ts asserts Export now writes must be
 * readable back in by mapRawRow, or a filled-in Import Template would fail
 * to re-import its own values. Iterates the full label tables rather than
 * one example per field, so a future code added to either side without its
 * counterpart is caught immediately.
 */
describe("mapRawRow — recognizes Export's own canonical Azerbaijani labels", () => {
  it("gender", () => {
    for (const [code, label] of Object.entries(GENDER_VALUE_LABELS)) {
      expect(mapSingleColumn("gender", label).gender).toBe(code)
    }
  })

  it("maritalStatus", () => {
    for (const [code, label] of Object.entries(MARITAL_STATUS_VALUE_LABELS)) {
      expect(mapSingleColumn("maritalStatus", label).maritalStatus).toBe(code)
    }
  })

  it("employmentType", () => {
    for (const [code, label] of Object.entries(EMPLOYMENT_TYPE_VALUE_LABELS)) {
      expect(mapSingleColumn("employmentType", label).employmentType).toBe(code)
    }
  })

  it("contractType", () => {
    for (const [code, label] of Object.entries(CONTRACT_TYPE_VALUE_LABELS)) {
      expect(mapSingleColumn("contractType", label).contractType).toBe(code)
    }
  })

  it("workLocationType", () => {
    for (const [code, label] of Object.entries(WORK_LOCATION_TYPE_VALUE_LABELS)) {
      expect(mapSingleColumn("workLocationType", label).workLocationType).toBe(code)
    }
  })

  it("is case-insensitive, matching how the rest of mapRawRow's normalization already behaves", () => {
    expect(mapSingleColumn("gender", "QADIN").gender).toBe("female")
    expect(mapSingleColumn("employmentType", "tam ştat").employmentType).toBe("full-time")
  })

  it("still recognizes the pre-existing English/abbreviated aliases (real-world files, not just Export's own output)", () => {
    expect(mapSingleColumn("gender", "Male").gender).toBe("male")
    expect(mapSingleColumn("maritalStatus", "Single").maritalStatus).toBe("single")
    expect(mapSingleColumn("employmentType", "full-time").employmentType).toBe("full-time")
    expect(mapSingleColumn("contractType", "permanent").contractType).toBe("permanent")
    expect(mapSingleColumn("workLocationType", "remote").workLocationType).toBe("remote")
  })
})
