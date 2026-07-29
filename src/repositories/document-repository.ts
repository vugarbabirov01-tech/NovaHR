import { prisma } from "@/lib/prisma"
import type { DocumentModel } from "@/generated/prisma/models"

export type { DocumentModel as Document }

/**
 * Generic, cross-module document metadata — never file bytes (see
 * DocumentStorageProvider for those). entityType/entityId is a plain
 * polymorphic reference; this repository has no idea what a "LEAVE_REQUEST"
 * or an "EMPLOYEE" is, and never should.
 */
export interface DocumentInput {
  entityType: string
  entityId: string
  category?: string | null
  fileName: string
  mimeType: string
  fileSize: number
  storageKey: string
  uploadedBy: string
}

export function findDocumentsForEntity(entityType: string, entityId: string): Promise<DocumentModel[]> {
  return prisma.document.findMany({
    where: { entityType, entityId },
    orderBy: { uploadedAt: "desc" },
  })
}

export function findDocumentById(id: string): Promise<DocumentModel | null> {
  return prisma.document.findUnique({ where: { id } })
}

export function createDocument(input: DocumentInput): Promise<DocumentModel> {
  return prisma.document.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      category: input.category ?? null,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      storageKey: input.storageKey,
      uploadedBy: input.uploadedBy,
    },
  })
}

export function deleteDocument(id: string): Promise<DocumentModel> {
  return prisma.document.delete({ where: { id } })
}
