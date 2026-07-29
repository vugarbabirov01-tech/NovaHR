import { randomUUID } from "node:crypto"

import {
  createDocument,
  deleteDocument as deleteDocumentRepo,
  findDocumentById,
  findDocumentsForEntity,
  type Document,
} from "@/repositories/document-repository"
import { documentStorageProvider } from "@/lib/integrations/document-storage-provider"
import { validateFileConstraints } from "@/lib/validation/documents"

/**
 * The one orchestration point for the generic Document module — combines
 * storage (bytes) and metadata (the Document row) so every caller gets an
 * atomic-enough "upload" primitive instead of having to coordinate both
 * itself. Nothing here is Leave-specific; allowedMimeTypes is supplied by
 * the caller, never assumed.
 */
export interface UploadDocumentInput {
  entityType: string
  entityId: string
  category?: string
  fileName: string
  mimeType: string
  fileSize: number
  data: Buffer
  uploadedBy: string
  allowedMimeTypes?: string[]
}

export async function uploadDocument(input: UploadDocumentInput): Promise<Document> {
  const constraintError = validateFileConstraints(
    { size: input.fileSize, type: input.mimeType },
    input.allowedMimeTypes
  )
  if (constraintError) throw new Error(constraintError)

  const storageKey = randomUUID()
  await documentStorageProvider.store(storageKey, input.data)

  return createDocument({
    entityType: input.entityType,
    entityId: input.entityId,
    category: input.category,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    storageKey,
    uploadedBy: input.uploadedBy,
  })
}

export function getDocumentsForEntity(entityType: string, entityId: string): Promise<Document[]> {
  return findDocumentsForEntity(entityType, entityId)
}

export function getDocumentById(id: string): Promise<Document | null> {
  return findDocumentById(id)
}

export async function deleteDocument(id: string): Promise<void> {
  const document = await findDocumentById(id)
  if (!document) return
  await documentStorageProvider.delete(document.storageKey)
  await deleteDocumentRepo(id)
}
