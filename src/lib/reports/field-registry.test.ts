import { describe, expect, it } from "vitest"

import {
  ALL_REPORT_FIELDS,
  getAggregatableFieldsForDataSource,
  getFieldsForDataSource,
  getReportFieldDefinition,
} from "@/lib/reports/field-registry"
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

  // Universal-analytics self-consistency (2026-11-11) — guards against a
  // future registry edit accidentally making a meaningless aggregation or
  // grouping reachable, since aggregation-engine.ts trusts these flags
  // without re-checking field type itself.
  describe("analytics metadata is only ever set where it can be meaningful", () => {
    it("aggregations is only set on type \"number\" fields", () => {
      for (const field of ALL_REPORT_FIELDS) {
        if (field.aggregations) expect(field.type).toBe("number")
      }
    })

    it("displayUnit is only set on type \"number\" fields", () => {
      for (const field of ALL_REPORT_FIELDS) {
        if (field.displayUnit) expect(field.type).toBe("number")
      }
    })

    it("groupable is only set explicitly on type \"string\" fields — enum fields are implicitly groupable already", () => {
      for (const field of ALL_REPORT_FIELDS) {
        if (field.groupable) expect(field.type).toBe("string")
      }
    })

    it("PAYROLL has no aggregatable field — no financial data until real RBAC exists", () => {
      for (const field of getFieldsForDataSource("PAYROLL")) {
        expect(field.aggregations ?? []).toHaveLength(0)
      }
    })

    // 2026-11-11 — no field is ever auto-suggested as a starting KPI
    // (the user's own explicit reversal of the earlier
    // "recommendedDefaultKpi" mechanism): a brand-new report shows only
    // the implicit row count until the user deliberately picks a stat.
    // supersededByField instead hides a technical duplicate from every
    // "pick a new stat" picker, without removing it from the registry.
    it("supersededByField always points at a REAL field in the SAME data source", () => {
      for (const field of ALL_REPORT_FIELDS) {
        if (!field.supersededByField) continue
        const target = getReportFieldDefinition(field.supersededByField)
        expect(target).toBeDefined()
        expect(target!.dataSource).toBe(field.dataSource)
      }
    })

    it("no field supersedes itself, and no two fields supersede each other (no cycle)", () => {
      for (const field of ALL_REPORT_FIELDS) {
        if (!field.supersededByField) continue
        expect(field.supersededByField).not.toBe(field.key)
        const target = getReportFieldDefinition(field.supersededByField)!
        expect(target.supersededByField).not.toBe(field.key)
      }
    })

    it("getAggregatableFieldsForDataSource excludes every superseded field, but the field itself still resolves by key", () => {
      expect(getAggregatableFieldsForDataSource("EMPLOYEES").map((f) => f.key)).not.toContain("tenureYears")
      expect(getAggregatableFieldsForDataSource("EMPLOYEES").map((f) => f.key)).not.toContain("tenureYearsDecimal")
      expect(getAggregatableFieldsForDataSource("EMPLOYEES").map((f) => f.key)).toContain("tenureDurationMonths")
      // still resolvable directly — a report saved before this change,
      // or any filter/column, keeps working exactly as before.
      expect(getReportFieldDefinition("tenureYears")).toBeDefined()
      expect(getReportFieldDefinition("tenureYearsDecimal")).toBeDefined()
    })
  })
})
