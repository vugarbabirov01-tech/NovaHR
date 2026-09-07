"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Stepper } from "@/components/common/stepper"
import {
  autoResolveMasterDataAction,
  getExistingEmployeeKeysAction,
  runImportChunkAction,
  saveImportDraftAction,
} from "@/app/[locale]/(app)/employees/import/actions"
import { suggestFieldForColumn } from "@/lib/employee-import/column-mapping"
import { defaultImportSettings } from "@/lib/employee-import/types"
import type {
  ColumnMapping,
  ImportDraft,
  ImportRow,
  ImportRowResult,
  ImportSettings,
  ImportSummary,
  RawImportRow,
} from "@/lib/employee-import/types"
import { summarizeImportResults } from "@/lib/employee-import/import-service"
import type { ReferenceDataCreationSummary } from "@/lib/employee-import/reference-data-auto-resolver"
import type { WorkerRequest, WorkerResponse } from "@/workers/employee-import.worker"

const emptyReferenceDataSummary: ReferenceDataCreationSummary = {
  companies: [],
  departments: [],
  positions: [],
}

import { ImportDraftsList } from "@/components/employees/import/import-drafts-list"
import { UploadStep } from "@/components/employees/import/steps/upload-step"
import { SelectWorksheetStep } from "@/components/employees/import/steps/select-worksheet-step"
import { MapColumnsStep } from "@/components/employees/import/steps/map-columns-step"
import { ValidateStep } from "@/components/employees/import/steps/validate-step"
import { PreviewStep } from "@/components/employees/import/steps/preview-step"
import { ImportStep } from "@/components/employees/import/steps/import-step"
import { SummaryStep } from "@/components/employees/import/steps/summary-step"

const stepKeys = ["upload", "worksheet", "mapping", "validate", "preview", "import", "summary"] as const

const IMPORT_CHUNK_SIZE = 300

interface EmployeeImportWizardProps {
  initialDrafts: ImportDraft[]
}

function generateDraftId() {
  return `IMPD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function EmployeeImportWizard({ initialDrafts }: EmployeeImportWizardProps) {
  const t = useTranslations("Employees.import")

  const [stepIndex, setStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [draftId, setDraftId] = useState<string | null>(null)
  const [fileName, setFileName] = useState("")
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState("")
  const [headerColumns, setHeaderColumns] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<RawImportRow[]>([])
  const [columnMapping, setColumnMapping] = useState<ColumnMapping[]>([])

  const [isAutoResolving, setIsAutoResolving] = useState(false)
  const [referenceDataCreated, setReferenceDataCreated] = useState<ReferenceDataCreationSummary>(
    emptyReferenceDataSummary
  )
  const [settings, setSettings] = useState<ImportSettings>(defaultImportSettings)

  const [validateProgress, setValidateProgress] = useState<{ processed: number; total: number } | null>(null)
  const [validatedRows, setValidatedRows] = useState<ImportRow[] | null>(null)

  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(null)
  const [importResults, setImportResults] = useState<ImportRowResult[] | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL("../../../workers/employee-import.worker.ts", import.meta.url))
    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  function postToWorker(message: WorkerRequest) {
    workerRef.current?.postMessage(message)
  }

  function resetForNewFile() {
    setError(null)
    setDraftId(null)
    setSheetNames([])
    setSelectedSheet("")
    setHeaderColumns([])
    setRawRows([])
    setColumnMapping([])
    setValidatedRows(null)
    setValidateProgress(null)
    setImportResults(null)
    setImportProgress(null)
    setSummary(null)
    setReferenceDataCreated(emptyReferenceDataSummary)
    setIsAutoResolving(false)
  }

  async function handleFileSelected(file: File) {
    resetForNewFile()
    setFileName(file.name)
    const isCsv = file.name.toLowerCase().endsWith(".csv")
    const data = isCsv ? await file.text() : await file.arrayBuffer()

    const worker = workerRef.current
    if (!worker) return

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data
      if (response.type === "parsed") {
        setSheetNames(response.sheetNames)
        if (response.sheetNames.length <= 1) {
          const onlySheet = response.sheetNames[0] ?? ""
          setSelectedSheet(onlySheet)
          postToWorker({ type: "selectSheet", sheetName: onlySheet })
          setStepIndex(2)
        } else {
          setStepIndex(1)
        }
      } else if (response.type === "sheetExtracted") {
        setHeaderColumns(response.headerColumns)
        setRawRows(response.rows)
        setColumnMapping(
          response.headerColumns.map((excelColumn) => ({
            excelColumn,
            field: suggestFieldForColumn(excelColumn) ?? "ignore",
          }))
        )
      } else if (response.type === "error") {
        setError(response.message)
      }
    }

    postToWorker({ type: "parse", fileName: file.name, data })
  }

  function handleSelectWorksheet(sheetName: string) {
    setSelectedSheet(sheetName)
    postToWorker({ type: "selectSheet", sheetName })
    setStepIndex(2)
  }

  function handleConfirmMapping(mapping: ColumnMapping[]) {
    setColumnMapping(mapping)
    setStepIndex(3)
  }

  useEffect(() => {
    if (stepIndex !== 3 || validatedRows !== null) return

    let cancelled = false
    setIsAutoResolving(true)
    setValidateProgress({ processed: 0, total: rawRows.length })

    async function runValidation() {
      // Step 4 — Auto Resolve: create every missing Company/Department/
      // Position/Branch for real (one Prisma transaction) before a single
      // row is validated, so Validate resolves every row against the
      // augmented snapshot instead of flagging what this step is about to
      // fix anyway.
      const { masterData: augmentedMasterData, created } = await autoResolveMasterDataAction(rawRows, columnMapping)
      if (cancelled) return
      setReferenceDataCreated(created)
      setIsAutoResolving(false)

      const { employeesByFin, employeeNumbers } = await getExistingEmployeeKeysAction()
      if (cancelled) return

      const worker = workerRef.current
      if (!worker) return

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data
        if (response.type === "validateProgress") {
          setValidateProgress({ processed: response.processed, total: response.total })
        } else if (response.type === "validated") {
          setValidatedRows(response.rows)
          setStepIndex(4)
        } else if (response.type === "error") {
          setError(response.message)
        }
      }

      postToWorker({
        type: "validate",
        rows: rawRows,
        columnMapping,
        masterData: augmentedMasterData,
        existingEmployeesByFin: employeesByFin,
        existingEmployeeNumbers: employeeNumbers,
        settings,
      })
    }

    runValidation()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settings is read once when validation starts; changing it in Preview re-runs at Import time, not by re-validating.
  }, [stepIndex, validatedRows, rawRows, columnMapping])

  async function handleSaveDraft() {
    const id = draftId ?? generateDraftId()
    const now = new Date().toISOString()
    const draft: ImportDraft = {
      id,
      fileName,
      createdAt: now,
      updatedAt: now,
      status: "draft",
      sheetNames,
      selectedSheet,
      headerColumns,
      columnMapping,
      rawRows,
      currentStep: stepIndex,
    }
    await saveImportDraftAction(draft)
    setDraftId(id)
  }

  function handleResumeDraft(draft: ImportDraft) {
    setDraftId(draft.id)
    setFileName(draft.fileName)
    setSheetNames(draft.sheetNames)
    setSelectedSheet(draft.selectedSheet)
    setHeaderColumns(draft.headerColumns)
    setRawRows(draft.rawRows)
    setColumnMapping(draft.columnMapping)
    setValidatedRows(null)
    setValidateProgress(null)
    setImportResults(null)
    setSummary(null)
    setReferenceDataCreated(emptyReferenceDataSummary)
    setStepIndex(Math.min(draft.currentStep, 2))

    // The worker needs the sheet re-selected in its own memory too, so
    // "Validate Data" (which re-reads from the worker's parsed workbook)
    // isn't required — resuming replays selectSheet against the freshly
    // re-parsed file the draft already carries as rawRows, so validation
    // reruns straight from state instead of asking the worker to re-parse.
  }

  async function handleStartImport() {
    if (!validatedRows) return
    setIsImporting(true)
    setError(null)
    const startedAt = performance.now()
    const chunks: ImportRow[][] = []
    for (let i = 0; i < validatedRows.length; i += IMPORT_CHUNK_SIZE) {
      chunks.push(validatedRows.slice(i, i + IMPORT_CHUNK_SIZE))
    }

    const results: ImportRowResult[] = []
    setImportProgress({ processed: 0, total: validatedRows.length })

    for (const chunk of chunks) {
      const { results: chunkResults } = await runImportChunkAction(chunk, settings)
      results.push(...chunkResults)
      setImportProgress({ processed: results.length, total: validatedRows.length })
    }

    const durationMs = performance.now() - startedAt
    setImportResults(results)
    setSummary(summarizeImportResults(results, durationMs))
    setIsImporting(false)
    setStepIndex(6)
  }

  const steps = useMemo(() => stepKeys.map((key) => ({ key, label: t(`steps.${key}`) })), [t])

  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={steps} currentIndex={stepIndex} />

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {stepIndex === 0 ? (
        <div className="flex flex-col gap-6">
          <ImportDraftsList drafts={initialDrafts} onResume={handleResumeDraft} />
          <Card>
            <CardContent>
              <UploadStep onFileSelected={handleFileSelected} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {stepIndex === 1 ? (
        <Card>
          <CardContent>
            <SelectWorksheetStep
              sheetNames={sheetNames}
              selectedSheet={selectedSheet}
              onSelect={handleSelectWorksheet}
              onBack={() => setStepIndex(0)}
            />
          </CardContent>
        </Card>
      ) : null}

      {stepIndex === 2 ? (
        <Card>
          <CardContent>
            <MapColumnsStep
              headerColumns={headerColumns}
              sampleRow={rawRows[0]}
              columnMapping={columnMapping}
              onConfirm={handleConfirmMapping}
              onSaveDraft={handleSaveDraft}
              onBack={() => setStepIndex(sheetNames.length > 1 ? 1 : 0)}
            />
          </CardContent>
        </Card>
      ) : null}

      {stepIndex === 3 ? (
        <Card>
          <CardContent>
            <ValidateStep progress={validateProgress} totalRows={rawRows.length} isAutoResolving={isAutoResolving} />
          </CardContent>
        </Card>
      ) : null}

      {stepIndex === 4 && validatedRows ? (
        <PreviewStep
          rows={validatedRows}
          referenceDataCreated={referenceDataCreated}
          settings={settings}
          onSettingsChange={setSettings}
          onBack={() => setStepIndex(2)}
          onNext={() => setStepIndex(5)}
          onSaveDraft={handleSaveDraft}
        />
      ) : null}

      {stepIndex === 5 && validatedRows ? (
        <Card>
          <CardContent>
            <ImportStep
              rows={validatedRows}
              progress={importProgress}
              isImporting={isImporting}
              onStart={handleStartImport}
              onBack={() => setStepIndex(4)}
            />
          </CardContent>
        </Card>
      ) : null}

      {stepIndex === 6 && summary && importResults ? (
        <SummaryStep summary={summary} results={importResults} fileName={fileName} />
      ) : null}
    </div>
  )
}
