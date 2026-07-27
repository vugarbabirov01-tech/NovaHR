export type ExportFormat = "xlsx" | "csv"
export type ExportScope = "all" | "filtered" | "selected"

/**
 * "importTemplate" is the exact 28-field IMPORTABLE_FIELD_ORDER shape —
 * 100% round-trip compatible with the Import Wizard. "fullReport" is a
 * superset with additional reporting-only columns (see
 * report-only-fields.ts) that Import will simply not recognize and ignore
 * on re-upload — by design, never round-trip compatible.
 */
export type ExportType = "importTemplate" | "fullReport"
