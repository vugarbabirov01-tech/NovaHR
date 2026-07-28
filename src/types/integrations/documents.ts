export type TerminationDocumentType =
  | "termination-order"
  | "asset-return-form"
  | "final-settlement-document"
  | "exit-clearance"

export interface DocumentRequest {
  type: TerminationDocumentType
  employeeId: string
  requestedAt: string
}

export interface DocumentProvider {
  requestDocument(request: DocumentRequest): Promise<void>
}
