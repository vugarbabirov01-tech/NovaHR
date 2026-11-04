import { describe, expect, it } from "vitest"

import { ALL_REPORT_FIELDS, getFieldsForDataSource, getReportFieldDefinition } from "@/lib/reports/field-registry"
import { ALL_DATA_SOURCE_KEYS } from "@/types/reports"

describe("field registry", () => {
  it("has a globally unique key for every field across every data source", () => {
    const keys = ALL_REPORT_FIELDS.map((field) => field.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("every field is reachable by both its bare key and by its own data source", () => {
    for (const field of ALL_REPORT_FIELDS) {
      expect(getReportFieldDefinition(field.key)).toBe(field)
      expect(getFieldsForDataSource(field.dataSource)).toContain(field)
    }
  })

  it("getFieldsForDataSource never returns a field belonging to another source", () => {
    for (const dataSource of ALL_DATA_SOURCE_KEYS) {
      for (const field of getFieldsForDataSource(dataSource)) {
        expect(field.dataSource).toBe(dataSource)
      }
    }
  })

  it("every declared data source has at least one field", () => {
    for (const dataSource of ALL_DATA_SOURCE_KEYS) {
      expect(getFieldsForDataSource(dataSource).length).toBeGreaterThan(0)
    }
  })
})
