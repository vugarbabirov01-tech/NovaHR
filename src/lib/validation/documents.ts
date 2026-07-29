import { z } from "zod"

// Generic upload validation — module-agnostic. A MIME-type allowlist is
// caller-supplied (e.g. Leave passes PDF/JPG/PNG for a leave application);
// this file never hardcodes what any particular module considers valid.

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export const documentUploadMetaSchema = z.object({
  entityType: z.string().trim().min(1, "entityType is required."),
  entityId: z.string().trim().min(1, "entityId is required."),
  category: z.string().trim().max(60).optional(),
  uploadedBy: z.string().trim().min(1, "uploadedBy is required."),
})

export function validateFileConstraints(
  file: { size: number; type: string },
  allowedMimeTypes?: string[]
): string | null {
  if (file.size === 0) return "The selected file is empty."
  if (file.size > MAX_FILE_SIZE_BYTES) return "The selected file exceeds the 10 MB size limit."
  if (allowedMimeTypes && !allowedMimeTypes.includes(file.type)) {
    return `Unsupported file type: ${file.type || "unknown"}.`
  }
  return null
}
