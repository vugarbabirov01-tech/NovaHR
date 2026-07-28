import { parseWorkbook, extractSheetRows } from "@/lib/employee-import/file-parser"
import { validateImportRows } from "@/lib/employee-import/row-validator"
import { ImportValidationMessages } from "@/lib/employee-import/validation-messages"
import type { ColumnMapping, RawImportRow } from "@/lib/employee-import/types"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"

/**
 * Parsing and validation both run here, off the main thread — the whole
 * reason this file exists is "must not freeze the UI" at 10,000+ rows.
 * Nothing here talks to the network or the DOM; it only ever receives
 * plain data and posts plain data back.
 */

export type WorkerRequest =
  | { type: "parse"; fileName: string; data: ArrayBuffer | string }
  | { type: "selectSheet"; sheetName: string }
  | {
      type: "validate"
      rows: RawImportRow[]
      columnMapping: ColumnMapping[]
      masterData: WizardMasterData
      existingFins: string[]
      existingEmployeeNumbers: string[]
    }

export type WorkerResponse =
  | { type: "parsed"; sheetNames: string[] }
  | { type: "sheetExtracted"; headerColumns: string[]; rows: RawImportRow[] }
  | { type: "validateProgress"; processed: number; total: number }
  | { type: "validated"; rows: ReturnType<typeof validateImportRows> }
  | { type: "error"; message: string }

let currentWorkbook: ReturnType<typeof parseWorkbook>["workbook"] | null = null

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  try {
    if (message.type === "parse") {
      const { workbook, sheetNames } = parseWorkbook(message.fileName, message.data)
      currentWorkbook = workbook
      post({ type: "parsed", sheetNames })
      return
    }

    if (message.type === "selectSheet") {
      if (!currentWorkbook) throw new Error(ImportValidationMessages.noFileParsedYet)
      const { headerColumns, rows } = extractSheetRows(currentWorkbook, message.sheetName)
      post({ type: "sheetExtracted", headerColumns, rows })
      return
    }

    if (message.type === "validate") {
      const results = validateImportRows(
        message.rows,
        message.columnMapping,
        message.masterData,
        new Set(message.existingFins.map((fin) => fin.trim().toUpperCase())),
        new Set(message.existingEmployeeNumbers),
        (processed, total) => post({ type: "validateProgress", processed, total })
      )
      post({ type: "validated", rows: results })
      return
    }
  } catch (error) {
    post({
      type: "error",
      message: error instanceof Error ? error.message : ImportValidationMessages.unknownWorkerError,
    })
  }
}

function post(response: WorkerResponse) {
  ;(self as unknown as Worker).postMessage(response)
}
