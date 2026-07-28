import type { DocumentProvider, DocumentRequest } from "@/types/integrations/documents"

/**
 * Temporary adapter — Document Management doesn't exist yet. This only
 * records that a document was requested; it never generates a PDF or
 * renders a template. A real Document Management module would replace this
 * one file with something that actually queues generation.
 */
class NoOpDocumentProvider implements DocumentProvider {
  async requestDocument(_request: DocumentRequest): Promise<void> {
    // Intentionally empty — preparing the integration point only.
  }
}

export const documentProvider: DocumentProvider = new NoOpDocumentProvider()
