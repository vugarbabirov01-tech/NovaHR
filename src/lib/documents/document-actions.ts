"use server"

import { getDocumentsForEntity, uploadDocument } from "@/lib/documents/document-service"
import type { Document } from "@/repositories/document-repository"

export interface UploadDocumentActionResult {
  success: boolean
  data?: Document
  error?: string
}

/**
 * FormData in, not a typed object — this is a real file upload, and Server
 * Actions accept FormData (including File values) natively. Generic: any
 * module can call this with its own entityType, this file has no idea what
 * a "leave application" is.
 */
export async function uploadDocumentAction(formData: FormData): Promise<UploadDocumentActionResult> {
  const file = formData.get("file")
  const entityType = formData.get("entityType")
  const entityId = formData.get("entityId")
  const category = formData.get("category")
  const uploadedBy = formData.get("uploadedBy")
  const allowedMimeTypesRaw = formData.get("allowedMimeTypes")

  if (!(file instanceof File)) return { success: false, error: "No file provided." }
  if (typeof entityType !== "string" || !entityType) return { success: false, error: "entityType is required." }
  if (typeof entityId !== "string" || !entityId) return { success: false, error: "entityId is required." }
  if (typeof uploadedBy !== "string" || !uploadedBy) return { success: false, error: "uploadedBy is required." }

  try {
    const data = Buffer.from(await file.arrayBuffer())
    const allowedMimeTypes =
      typeof allowedMimeTypesRaw === "string" && allowedMimeTypesRaw ? allowedMimeTypesRaw.split(",") : undefined

    const document = await uploadDocument({
      entityType,
      entityId,
      category: typeof category === "string" && category ? category : undefined,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      data,
      uploadedBy,
      allowedMimeTypes,
    })
    return { success: true, data: document }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not upload document." }
  }
}

export async function getDocumentsForEntityAction(entityType: string, entityId: string): Promise<Document[]> {
  return getDocumentsForEntity(entityType, entityId)
}
